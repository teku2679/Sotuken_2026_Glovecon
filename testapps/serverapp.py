# ====================================================================
# PC側中継スクリプト（完全非同期・超低遅延・10ms通信対応版）
# ====================================================================
import asyncio
import socket
import time
import websockets

connected_clients = set()
relay_clients = set()
robot_monitor_clients = set()
ESP_address = None
robot_address = None
robot_last_seen = 0.0
robot_connected = False


def send_udp_datagram(message, address):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        return sock.sendto(message, address)


async def broadcast_robot_status(message):
    status_clients = relay_clients | robot_monitor_clients
    if status_clients:
        await asyncio.gather(
            *[client.send(message) for client in status_clients],
            return_exceptions=True,
        )


# ─── 1. WebSocket ブラウザ接続管理 ───
async def register(websocket):
    connected_clients.add(websocket)
    print(f"[WS] ブラウザ接続完了。現在: {len(connected_clients)}人")

    try:
        async for message in websocket:
            if message == "RELAY:HELLO":
                relay_clients.add(websocket)
                await websocket.send(
                    "ROBOT:CONNECTED" if robot_connected else "ROBOT:DISCONNECTED"
                )
                continue

            if message == "ROBOT:MONITOR":
                robot_monitor_clients.add(websocket)
                await websocket.send(
                    "ROBOT:CONNECTED" if robot_connected else "ROBOT:DISCONNECTED"
                )
                continue

            if message.startswith("ROBOT|"):
                command = message[len("ROBOT|"):].strip()
                if command and robot_connected and robot_address:
                    try:
                        loop = asyncio.get_running_loop()
                        await loop.run_in_executor(
                            None,
                            send_udp_datagram,
                            f"{command}\n".encode("utf-8"),
                            robot_address,
                        )
                    except Exception as err:
                        print(f"[転送エラー] ロボットへのUDP送信失敗: {err}")
                else:
                    await websocket.send("ROBOT:DISCONNECTED")
                continue

            raw_cmd = message.strip().upper()
            if not raw_cmd:
                continue

            cmd = None
            if "W" in raw_cmd:
                cmd = "W"
            elif "U" in raw_cmd:
                cmd = "U"
            elif "B" in raw_cmd:
                cmd = "B"

            if cmd:
                print(f"[WS受信成功] ブラウザからコマンドを検知しました: '{cmd}'")
                if ESP_address:
                    print(
                        f"[WS -> UDP転送] コマンド '{cmd}\n' を ESP ({ESP_address}:8888) へ送信します"
                    )
                    try:
                        loop = asyncio.get_running_loop()
                        await loop.run_in_executor(
                            None,
                            send_udp_datagram,
                            f"{cmd}\n".encode("utf-8"),
                            (ESP_address, 8888),
                        )
                    except Exception as err:
                        print(f"[転送エラー] ESPへのUDP送信失敗: {err}")
                else:
                    print(
                        f"[警告] コマンド '{cmd}' を受け取りましたが、ESPのIPアドレスがまだ自動登録されていません。"
                    )
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        relay_clients.discard(websocket)
        robot_monitor_clients.discard(websocket)
        print(
            f"[WS] ブラウザが切断しました。残りの接続数: {len(connected_clients)}"
        )


# ブラウザへの一斉配信
async def broadcast(message):
    if connected_clients:
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True,
        )


# ─── 2. 高速非同期UDPプロトコルの定義 ───
class UltraLowLatencyUDPProtocol(asyncio.DatagramProtocol):
    def __init__(self):
        super().__init__()
        self.transport = None

    def connection_made(self, transport):
        self.transport = transport
        sock = self.transport.get_extra_info("socket")
        if sock:
            try:
                sock.setsockopt(
                    socket.SOL_SOCKET, socket.SO_RCVBUF, 64 * 1024
                )  # 64KBに拡大
            except Exception as err:
                print(f"[警告] ソケットバッファ拡大失敗: {err}")

    def datagram_received(self, data, addr):
        global ESP_address, robot_address, robot_last_seen
        try:
            message = data.decode("utf-8", errors="replace").strip()
            if not message:
                return

            if message == "ROBOT_HELLO":
                if robot_address != addr or time.monotonic() - robot_last_seen >= 3:
                    print(f"[ROBOT] Wi-Fi UDP connected: {addr[0]}:{addr[1]}")
                robot_address = addr
                robot_last_seen = time.monotonic()
                return

            parts = message.split(",")

            # 13要素（クォータニオン4 + 加速度3 + Flex6）の検知
            if len(parts) == 13:
                if ESP_address != addr[0]:
                    ESP_address = addr[0]
                    print(
                        f"\n[SYSTEM] ESP32のIPアドレスを自動認識しました: {ESP_address} (Port: {addr[1]})\n"
                    )

                if connected_clients:
                    asyncio.create_task(broadcast(message))
            else:
                print(f"[UDPデバッグ] 要素数不一致 ({len(parts)}個): {message}")

        except Exception as err:
            print(f"[パケット処理エラー] {err}")

    def error_received(self, exc):
        print(f"[UDPエラー] {exc}")


async def monitor_robot_connection():
    global robot_connected
    while True:
        await asyncio.sleep(1)
        is_connected = bool(robot_address and time.monotonic() - robot_last_seen < 3)
        if is_connected != robot_connected:
            robot_connected = is_connected
            await broadcast_robot_status(
                "ROBOT:CONNECTED" if robot_connected else "ROBOT:DISCONNECTED"
            )


# ─── 3. メインエントリーポイント ───
async def main():
    loop = asyncio.get_running_loop()
    asyncio.create_task(monitor_robot_connection())
    udp_transport, _ = await loop.create_datagram_endpoint(
        UltraLowLatencyUDPProtocol, local_addr=("0.0.0.0", 8888)
    )
    print("[UDP] 非同期待ち受け中 (Port: 8888)...")

    async with websockets.serve(register, "0.0.0.0", 8081):
        print("[WS] サーバー起動完了 (ws://localhost:8081)")
        try:
            await asyncio.Future()  # 永続待機
        finally:
            udp_transport.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n中継を終了します。")