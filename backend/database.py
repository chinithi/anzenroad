# -*- coding: utf-8 -*-
import sqlite3
import os

# データベースファイルの保存先ディレクトリとパスの設定
DB_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_PATH = os.path.join(DB_DIR, 'anzenroad.db')

def get_db_connection():
    """
    SQLiteデータベースへの接続を取得する関数。
    ディレクトリが存在しない場合は自動作成し、レコードを辞書形式(sqlite3.Row)で扱えるように設定します。
    """
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    データベーステーブルの初期化および初期データ(モックデータ)の投入を行う関数。
    - dangerous_spots: ユーザーが投稿した危険箇所の記録
    - jurisdictions: 自治体窓口および警察署の管轄マスターデータ
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. 危険箇所テーブルの作成
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dangerous_spots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,       -- 緯度
            longitude REAL NOT NULL,      -- 経度
            address TEXT,                 -- 住所
            target_type TEXT NOT NULL,    -- 提出先区分 ('police':警察署, 'mayor':役所)
            danger_category TEXT NOT NULL, -- 危険カテゴリ (見通し、交通量など)
            danger_level INTEGER NOT NULL, -- 危険度 (1〜5段階の星)
            description TEXT,             -- 具体的な状況・説明文
            requester_name TEXT,          -- 要望者氏名
            requester_address TEXT,       -- 要望者住所
            requester_phone TEXT,         -- 要望者電話番号
            photo_path TEXT,              -- 添付写真の保存サーバーパス
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 登録日時
        )
    ''');
    
    # 2. 管轄マスターテーブルの作成
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jurisdictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,           -- 窓口・署名
            type TEXT NOT NULL,           -- 区分 ('police' または 'mayor')
            address TEXT,                 -- 所在地住所
            phone TEXT,                   -- 連絡先電話番号
            online_url TEXT,              -- オンライン窓口等のホームページURL
            latitude REAL,                -- 窓口の緯度（最寄判定用）
            longitude REAL                -- 窓口の経度（最寄判定用）
        )
    ''')
    
    # jurisdictionsが空の場合、東京・横浜・大阪の主要な警察署・区役所のモックデータを投入
    cursor.execute('SELECT COUNT(*) FROM jurisdictions')
    if cursor.fetchone()[0] == 0:
        mock_data = [
            # 新宿エリア
            ("新宿警察署", "police", "東京都新宿区西新宿6丁目1-1", "03-3346-0110", "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/shokai/ichiran/kankatsu/shinjuku.html", 35.6925, 139.6961),
            ("新宿区役所 道路課", "mayor", "東京都新宿区歌舞伎町1-4-1", "03-3209-1111", "https://www.city.shinjuku.lg.jp/soshiki/douros-index.html", 35.6938, 139.7034),
            
            # 渋谷エリア
            ("渋谷警察署", "police", "東京都渋谷区渋谷3丁目22-7", "03-3498-0110", "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/shokai/ichiran/kankatsu/shibuya.html", 35.6565, 139.7042),
            ("渋谷区役所 土木部道路管理課", "mayor", "東京都渋谷区宇田川町1-1", "03-3463-1211", "https://www.city.shibuya.tokyo.jp/kusei/shokai/soshiki/doboku.html", 35.6640, 139.6982),
            
            # 千代田エリア
            ("麹町警察署", "police", "東京都千代田区麹町1丁目4", "03-3234-0110", "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/shokai/ichiran/kankatsu/kojimachi.html", 35.6840, 139.7420),
            ("千代田区役所 道路公園課", "mayor", "東京都千代田区九段南1丁目2-1", "03-3264-2111", "https://www.city.chiyoda.lg.jp/koho/kurashi/doro/index.html", 35.6942, 139.7505),
            
            # 横浜エリア
            ("加賀町警察署", "police", "神奈川県横浜市中区山下町203", "045-641-0110", "https://www.police.pref.kanagawa.jp/ps/40ps/40mes001.htm", 35.4439, 139.6429),
            ("横浜市 中区役所 土木事務所", "mayor", "神奈川県横浜市中区日本大通35", "045-224-8181", "https://www.city.yokohama.lg.jp/naka/kurashi/machizukuri_kankyo/doboku/doboku.html", 35.4448, 139.6422),
            
            # 大阪エリア
            ("曽根崎警察署", "police", "大阪府大阪市北区曽根崎2丁目16-14", "06-6315-1234", "https://www.police.pref.osaka.lg.jp/sogo/ps/kita/sonezaki/index.html", 34.7013, 135.5015),
            ("大阪市北区役所 地域課", "mayor", "大阪府大阪市北区扇町2丁目1-27", "06-6313-9986", "https://www.city.osaka.lg.jp/kita/page/0000002166.html", 34.7047, 135.5103),
        ]
        cursor.executemany('''
            INSERT INTO jurisdictions (name, type, address, phone, online_url, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', mock_data)
        
    conn.commit()
    conn.close()

def find_closest_jurisdiction(lat, lng, target_type):
    """
    指定された経緯度(lat, lng)および提出先区分(target_type)から、最も距離の近い窓口情報を検索します。
    ※距離計算は、緯度経度差の平方和による簡易的なユークリッド距離を使用しています。
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT *, 
               ((latitude - ?) * (latitude - ?)) + ((longitude - ?) * (longitude - ?)) AS distance
        FROM jurisdictions
        WHERE type = ?
        ORDER BY distance ASC
        LIMIT 1
    ''', (lat, lat, lng, lng, target_type))
    result = cursor.fetchone()
    conn.close()
    if result:
        return dict(result)
    return None

def save_spot(data):
    """
    新規に危険箇所投稿レポートをデータベースへ保存します。
    - data: 投稿フォームから送信された値の辞書
    - 戻り値: 保存されたレコードのID
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO dangerous_spots (
            latitude, longitude, address, target_type, danger_category, 
            danger_level, description, requester_name, requester_address, 
            requester_phone, photo_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['latitude'], data['longitude'], data.get('address'), data['target_type'],
        data['danger_category'], data['danger_level'], data.get('description'),
        data.get('requester_name'), data.get('requester_address'), data.get('requester_phone'),
        data.get('photo_path')
    ))
    conn.commit()
    spot_id = cursor.lastrowid
    conn.close()
    return spot_id

def get_all_spots():
    """
    データベースに登録されているすべての危険箇所情報を、登録日時の新しい順で取得します。
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM dangerous_spots ORDER BY created_at DESC
    ''')
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results

if __name__ == '__main__':
    # スクリプト直接実行時にデータベース初期化を実行
    init_db()
    print("Database initialized successfully at:", DB_PATH)
