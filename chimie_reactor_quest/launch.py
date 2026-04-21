from __future__ import annotations

import os
import socket
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)


def find_free_port(start: int = 8000, stop: int = 8050, host: str = '127.0.0.1') -> int:
    for port in range(start, stop + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    return start


def detect_lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(('8.8.8.8', 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith('127.'):
                return ip
    except OSError:
        pass
    return None


def main(share: bool = False) -> None:
    host = '0.0.0.0' if share else '127.0.0.1'
    port = int(os.environ.get('PORT') or find_free_port())
    os.environ['HOST'] = host
    os.environ['PORT'] = str(port)

    local_url = f'http://127.0.0.1:{port}'
    lan_ip = detect_lan_ip() if share else None
    network_url = f'http://{lan_ip}:{port}' if lan_ip else None

    def open_browser_later() -> None:
        time.sleep(1.2)
        try:
            webbrowser.open(local_url)
        except Exception:
            pass

    threading.Thread(target=open_browser_later, daemon=True).start()

    print('\n' + '=' * 68)
    print(' Chimie Academy · Reactor Quest')
    print('=' * 68)
    print(f' Calculator: {local_url}')
    if share:
        if network_url:
            print(f' Telefon / alt dispozitiv: {network_url}')
        else:
            print(' Telefon / alt dispozitiv: pornește, dar IP-ul local nu a putut fi detectat automat.')
    print(' Oprești serverul cu Ctrl+C.')
    print('=' * 68 + '\n')

    from app import app

    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    main(share=False)
