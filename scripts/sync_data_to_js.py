#!/usr/bin/env python3
"""
Syncs data/finance_data.json into data/finance_data.js as window.myFinanceData
for direct file:// protocol loading without requiring an HTTP server.
"""

import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def sync():
    targets = [
        ('finance_data.json', 'finance_data.js'),
        ('my_finance_data.json', 'my_finance_data.js')
    ]
    for json_name, js_name in targets:
        json_path = os.path.join(BASE_DIR, 'data', json_name)
        js_path = os.path.join(BASE_DIR, 'data', js_name)
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            js_content = f"// Auto-generated for direct file:// loading\nwindow.myFinanceData = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
            with open(js_path, 'w', encoding='utf-8') as f:
                f.write(js_content)
            print(f"Successfully synced {json_path} -> {js_path}")

if __name__ == '__main__':
    sync()
