import pandas as pd
import json
import os

# 定数
CSV_URL = "https://docs.google.com/spreadsheets/d/1dTxRNuMcz4JCbh2Wp-fWxAZE814wcQOWtXdEeNW6FHE/export?format=csv&gid=332015244"
MASTER_DATA_PATH = "public/data/master_data.json"

def main():
    """
    CSVデータをURLから読み込み、master_data.jsonのitemsリストを更新する
    """
    if CSV_URL == "[ここにCSVのURL]":
        print("エラー: CSV_URL が設定されていません。スクリプト内の CSV_URL をスプレッドシートの公開URL（CSV）に書き換えてください。")
        return

    try:
        # 1. 既存の master_data.json を読み込む
        if os.path.exists(MASTER_DATA_PATH):
            with open(MASTER_DATA_PATH, 'r', encoding='utf-8') as f:
                master_data = json.load(f)
        else:
            print(f"エラー: {MASTER_DATA_PATH} が見つかりません。")
            return

        # 2. CSVをURLから読み込む
        print(f"CSVをダウンロード中...: {CSV_URL}")
        df = pd.read_csv(CSV_URL)
        
        # NaNをNoneあるいは適切な値に変換 (JSON化の際にエラーにならないように)
        # pandasのto_dictはNaNをそのまま残すことがあるため、whereで置換
        # fillna(0) replaces all NaNs with 0 as requested
        df = df.fillna(0)
        
        # itemsリストに変換
        new_items = df.to_dict(orient='records')
        
        # 3. items キーを更新 (Data Cleaning)
        print(f"アイテムデータを更新中... ({len(new_items)} 件)")
        
        cleaned_count = 0
        for item in new_items:
            # Check for column shift: RES has description text
            res_val = item.get('res')
            desc_val = item.get('description')
            
            # If RES is a string (and not convertible to float easily, though '10' is str)
            # and Description is 0 or empty.
            if isinstance(res_val, str) and not res_val.replace('.','',1).isdigit():
                # Potential shift
                # Check if description is empty/0
                if desc_val == 0 or desc_val == "" or desc_val is None:
                    # Apply shift
                    item['description'] = res_val
                    item['res'] = 0
                    cleaned_count += 1
        
        if cleaned_count > 0:
            print(f"Fixed column shift for {cleaned_count} items.")

        master_data['items'] = new_items
        
        # 4. JSONファイルとして保存
        with open(MASTER_DATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(master_data, f, indent=4, ensure_ascii=False)
        
        print(f"'{MASTER_DATA_PATH}' の items を正常に更新しました。")

    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    main()
