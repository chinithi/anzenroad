# -*- coding: utf-8 -*-
import sqlite3
import os
import re

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
    データベーステーブルの初期化および初期データ(全国主要自治体・愛知県含む管轄データ)の投入を行う関数。
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
    ''')
    
    # 2. 管轄マスターテーブルの作成
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jurisdictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,    -- 窓口・署名 (重複防止)
            type TEXT NOT NULL,           -- 区分 ('police' または 'mayor')
            address TEXT,                 -- 所在地住所
            phone TEXT,                   -- 連絡先電話番号
            online_url TEXT,              -- オンライン窓口等のホームページURL
            latitude REAL,                -- 窓口の緯度（最寄判定用）
            longitude REAL                -- 窓口の経度（最寄判定用）
        )
    ''')
    
    # 主要都市・愛知県・全国の警察署・自治体窓口マスターデータ
    master_data = [
        # --- 愛知県（東三河・豊橋・豊川・岡崎・豊田・名古屋など） ---
        ("豊橋市役所 道路維持課", "mayor", "愛知県豊橋市今橋町1番地", "0532-51-2111", "https://www.city.toyohashi.lg.jp/", 34.7692, 137.3916),
        ("豊橋警察署 交通規制係", "police", "愛知県豊橋市八町通3丁目8", "0532-54-0110", "https://www.pref.aichi.jp/police/keisatsusho/toyohashi/", 34.7678, 137.3945),
        ("豊川市役所 道路河川課", "mayor", "愛知県豊川市諏訪1丁目1番地", "0533-89-2111", "https://www.city.toyokawa.lg.jp/", 34.8272, 137.3712),
        ("豊川警察署 交通課", "police", "愛知県豊川市諏訪2丁目4", "0533-89-0110", "https://www.pref.aichi.jp/police/keisatsusho/toyokawa/", 34.8256, 137.3698),
        ("岡崎市役所 道路維持課", "mayor", "愛知県岡崎市十王町2丁目9番地", "0564-23-6000", "https://www.city.okazaki.lg.jp/", 34.9554, 137.1685),
        ("岡崎警察署 交通規制係", "police", "愛知県岡崎市明大寺町字銭堤4-1", "0564-58-0110", "https://www.pref.aichi.jp/police/keisatsusho/okazaki/", 34.9469, 137.1672),
        ("豊田市役所 幹線道路課", "mayor", "愛知県豊田市西町3丁目60番地", "0565-31-1212", "https://www.city.toyota.aichi.jp/", 35.0838, 137.1559),
        ("豊田警察署 交通規制係", "police", "愛知県豊田市錦町1丁目59-1", "0565-35-0110", "https://www.pref.aichi.jp/police/keisatsusho/toyota/", 35.0776, 137.1491),
        ("名古屋市役所 緑政土木局", "mayor", "愛知県名古屋市中区三の丸3丁目1番1号", "052-961-1111", "https://www.city.nagoya.jp/", 35.1815, 136.9064),
        ("中警察署（愛知県警）", "police", "愛知県名古屋市中区千代田2丁目23-18", "052-241-0110", "https://www.pref.aichi.jp/police/keisatsusho/naka/", 35.1585, 136.9152),
        ("浜松市役所 土木部", "mayor", "静岡県浜松市中央区元城町103-2", "053-457-2111", "https://www.city.hamamatsu.shizuoka.jp/", 34.7108, 137.7261),
        ("浜松中央警察署", "police", "静岡県浜松市中央区住吉5丁目28-1", "053-475-0110", "https://www.pref.shizuoka.jp/police/", 34.7335, 137.7212),

        # --- 東京エリア ---
        ("新宿警察署 交通課", "police", "東京都新宿区西新宿6丁目1-1", "03-3346-0110", "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/shokai/ichiran/kankatsu/shinjuku.html", 35.6925, 139.6961),
        ("新宿区役所 道路課", "mayor", "東京都新宿区歌舞伎町1-4-1", "03-3209-1111", "https://www.city.shinjuku.lg.jp/soshiki/douros-index.html", 35.6938, 139.7034),
        ("渋谷警察署 交通課", "police", "東京都渋谷区渋谷3丁目22-7", "03-3498-0110", "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/shokai/ichiran/kankatsu/shibuya.html", 35.6565, 139.7042),
        ("渋谷区役所 土木部道路管理課", "mayor", "東京都渋谷区宇田川町1-1", "03-3463-1211", "https://www.city.shibuya.tokyo.jp/kusei/shokai/soshiki/doboku.html", 35.6640, 139.6982),
        ("麹町警察署 交通課", "police", "東京都千代田区麹町1丁目4", "03-3234-0110", "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/shokai/ichiran/kankatsu/kojimachi.html", 35.6840, 139.7420),
        ("千代田区役所 道路公園課", "mayor", "東京都千代田区九段南1丁目2-1", "03-3264-2111", "https://www.city.chiyoda.lg.jp/koho/kurashi/doro/index.html", 35.6942, 139.7505),

        # --- 神奈川・横浜エリア ---
        ("加賀町警察署", "police", "神奈川県横浜市中区山下町203", "045-641-0110", "https://www.police.pref.kanagawa.jp/ps/40ps/40mes001.htm", 35.4439, 139.6429),
        ("横浜市 中区役所 土木事務所", "mayor", "神奈川県横浜市中区日本大通35", "045-224-8181", "https://www.city.yokohama.lg.jp/naka/kurashi/machizukuri_kankyo/doboku/doboku.html", 35.4448, 139.6422),

        # --- 関西エリア ---
        ("曽根崎警察署 交通課", "police", "大阪府大阪市北区曽根崎2丁目16-14", "06-6315-1234", "https://www.police.pref.osaka.lg.jp/sogo/ps/kita/sonezaki/index.html", 34.7013, 135.5015),
        ("大阪市北区役所 地域課", "mayor", "大阪府大阪市北区扇町2丁目1-27", "06-6313-9986", "https://www.city.osaka.lg.jp/kita/page/0000002166.html", 34.7047, 135.5103),
        ("京都府警察 中京警察署", "police", "京都府京都市中京区壬生坊城町48-1", "075-841-0110", "https://www.pref.kyoto.jp/fukei/", 35.0035, 135.7423),
        ("京都市役所 建設局道路部", "mayor", "京都府京都市中京区寺町通御池上る上本能寺前町488", "075-222-3111", "https://www.city.kyoto.lg.jp/", 35.0116, 135.7681),
    ]

    for item in master_data:
        cursor.execute('''
            INSERT OR IGNORE INTO jurisdictions (name, type, address, phone, online_url, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', item)
        
    conn.commit()
    conn.close()

def parse_address_components(address):
    """
    日本語の住所文字列から、都道府県名および市区町村名を抽出するユーティリティ。
    例: '愛知県豊橋市牟呂町' -> ('愛知県', '豊橋市')
    """
    if not address or not isinstance(address, str):
        return None, None
    
    # 都道府県の抽出
    pref_match = re.search(r'^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)', address)
    pref = pref_match.group(1) if pref_match else ""
    rest = address[len(pref):] if pref else address
    
    # 政令指定都市の区、または通常の市・区・町・村を抽出
    city_match = re.search(r'([^市区町村]+(?:市[^市区町村]+区|区|市|町|村))', rest)
    city = city_match.group(1) if city_match else ""
    
    return pref, city

def infer_jurisdiction_from_address(address, target_type, lat=0, lng=0):
    """
    住所から最適な自治体窓口または警察署を自動生成して返却します。
    全国どの住所が入力されても、実在性の高い管轄組織名と住所を導出します。
    """
    pref, city = parse_address_components(address)
    
    if not city:
        city = "管轄市区町村"
    
    if target_type == 'police':
        clean_city = city.split('市')[-1] if '市' in city and '区' in city else city
        # '豊橋市' -> '豊橋'
        base_name = clean_city.rstrip('市区町村')
        pref_label = f"{pref} " if pref else ""
        return {
            'name': f"{pref_label}{base_name}警察署 交通規制係",
            'type': 'police',
            'address': f"{pref}{city} 周辺管轄",
            'phone': '110 (または各警察署代表)',
            'online_url': '#',
            'latitude': lat,
            'longitude': lng,
            'is_inferred': True
        }
    else:
        # 自治体窓口
        if '区' in city:
            dept = "土木事務所・道路管理課"
            office = f"{city}役所" if not city.endswith('役所') else city
        elif '町' in city or '村' in city:
            dept = "建設環境課"
            office = f"{city}役場"
        else:
            dept = "道路維持・管理担当課"
            office = f"{city}役所"

        return {
            'name': f"{office} {dept}",
            'type': 'mayor',
            'address': f"{pref}{city} 本庁舎・管轄事務所",
            'phone': '各自治体代表番号',
            'online_url': '#',
            'latitude': lat,
            'longitude': lng,
            'is_inferred': True
        }

def find_closest_jurisdictions(lat, lng, target_type, address="", limit=6):
    """
    指定された経緯度(lat, lng)および住所(address)から、
    1. 住所に基づく高精度な自動推測窓口
    2. 距離の近い登録窓口リスト（候補）
    を算出して辞書形式で返却します。
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT *, 
               ((latitude - ?) * (latitude - ?)) + ((longitude - ?) * (longitude - ?)) AS distance
        FROM jurisdictions
        WHERE type = ?
        ORDER BY distance ASC
        LIMIT ?
    ''', (lat, lat, lng, lng, target_type, limit))
    db_results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    candidates = []
    
    # 住所情報がある場合、住所から高精度推定した窓口を筆頭候補として作成
    inferred = None
    if address:
        inferred = infer_jurisdiction_from_address(address, target_type, lat, lng)
        candidates.append(inferred)

    # データベースの最寄り候補を追加（重複しないように名称でフィルタ）
    seen_names = set([inferred['name']] if inferred else [])
    for row in db_results:
        if row['name'] not in seen_names:
            seen_names.add(row['name'])
            candidates.append(row)

    # デフォルトの最寄り窓口を決定（住所推定があればそれを優先、なければDBの最寄り）
    primary = inferred if inferred else (db_results[0] if db_results else None)

    return {
        'primary': primary,
        'candidates': candidates
    }

def find_closest_jurisdiction(lat, lng, target_type, address=""):
    """
    従来の単一返却用APIとの後方互換用関数。最も適切な窓口を1件返却します。
    """
    res = find_closest_jurisdictions(lat, lng, target_type, address=address, limit=1)
    return res.get('primary')

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
