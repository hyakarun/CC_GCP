import pandas as pd
import json
import os
import requests
import io

# 設定
STORY_CSV_URL = "https://docs.google.com/spreadsheets/d/1dTxRNuMcz4JCbh2Wp-fWxAZE814wcQOWtXdEeNW6FHE/export?format=csv&gid=1459832009" 
MASTER_DATA_PATH = "public/data/master_data.json"

def main():
    print("ストーリーデータの更新を開始します")

    df = None

    if STORY_CSV_URL and STORY_CSV_URL.startswith("http"):
        print(f"URLからダウンロードします: {STORY_CSV_URL}")
        try:
            res = requests.get(STORY_CSV_URL)
            res.raise_for_status()
            df = pd.read_csv(io.StringIO(res.content.decode('utf-8'))) 
        except Exception as e:
            print(f"ダウンロードエラー: {e}")
            return
    else:
        print("有効なCSVソースが見つかりませんでした。")
        return

    if df is None:
        print("データフレームの作成に失敗しました。")
        return

    # データの加工 (Fill-down: 空欄を上の行の値で埋める)
    fill_cols = ['id', 'dungeon_id', 'timing']
    for col in fill_cols:
        if col in df.columns:
            # fillna(method='ffill') is deprecated in newer pandas, use ffill()
            df[col] = df[col].ffill()

    # NaNを空文字に変換
    df = df.fillna("")

    # 辞書リストに変換
    stories_list = df.to_dict(orient='records')

    # 型変換とクリーニング
    cleaned_stories = []
    for row in stories_list:
        try:
            # IDが空でなく、数値として扱えるか確認
            raw_id = row.get('id')
            if raw_id == "" or raw_id is None:
                continue
            
            story_id = int(float(raw_id))
            dungeon_id = int(float(row.get('dungeon_id', 0))) if row.get('dungeon_id') != "" else 0
            seq = int(float(row.get('seq', 0))) if row.get('seq') != "" else 0
            
            if story_id == 0: continue

            new_row = {
                "id": story_id,
                "dungeon_id": dungeon_id,
                "timing": str(row.get('timing', '')).strip(),
                "seq": seq,
                "speaker": str(row.get('speaker', '')).strip(),
                "message": str(row.get('message', '')).strip(),
                "left_image": str(row.get('left_image', '')).strip(),
                "right_image": str(row.get('right_image', '')).strip()
            }
            cleaned_stories.append(new_row)
        except Exception as e:
            print(f"行の変換エラー: {row} -> {e}")

    print(f"変換完了: {len(cleaned_stories)} 件のストーリーデータ")

    if not os.path.exists(MASTER_DATA_PATH):
        print(f"エラー: {MASTER_DATA_PATH} が見つかりません。")
        return

    with open(MASTER_DATA_PATH, 'r', encoding='utf-8') as f:
        master_data = json.load(f)

    # stories キーを更新
    master_data['stories'] = cleaned_stories

    with open(MASTER_DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=4, ensure_ascii=False)

    print(f"'{MASTER_DATA_PATH}' の stories を更新しました！")

if __name__ == "__main__":
    main()
