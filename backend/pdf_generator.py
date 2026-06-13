# -*- coding: utf-8 -*-
import os
import math
import requests
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors

# 成果物（位置図マップ、生成PDF等）の保存ディレクトリパス
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
FONTS_DIR = os.path.join(DATA_DIR, 'fonts')
os.makedirs(FONTS_DIR, exist_ok=True)

# -------------------------------------------------------------------------
# 日本語フォント登録処理
# -------------------------------------------------------------------------
IS_FONT_REGISTERED = False

def register_japanese_font():
    global IS_FONT_REGISTERED
    if IS_FONT_REGISTERED:
        return
    """
    ReportLab PDFエンジンで日本語を表示可能にするため、フォントを検索・登録する関数。
    1. Windowsシステム標準フォント(MSゴシック, MS明朝, メイリオ)を優先的に探索
    2. 見つからない場合はIPAexGothicフォントをプログラムから自動ダウンロードして代替します
    """
    font_paths_to_try = [
        r"C:\Windows\Fonts\msgothic.ttc",
        r"C:\Windows\Fonts\msmincho.ttc",
        r"C:\Windows\Fonts\meiryo.ttc",
    ]
    
    registered = False
    for path in font_paths_to_try:
        if os.path.exists(path):
            try:
                # 日本語フォントを「JapaneseFont」という名前で登録
                pdfmetrics.registerFont(TTFont('JapaneseFont', path))
                registered = True
                print(f"Registered system font: {path}")
                break
            except Exception as e:
                print(f"Failed to register system font {path}: {e}")
                
    if not registered:
        # システムフォントが無い場合のフォールバック（IPAexGothicをダウンロード）
        fallback_font_path = os.path.join(FONTS_DIR, 'ipaexg.ttf')
        if not os.path.exists(fallback_font_path):
            print("Downloading IPAexGothic font fallback...")
            try:
                url = "https://github.com/ipa-font/ipaexfont/raw/main/ipaexg00401/ipaexg.ttf"
                r = requests.get(url, timeout=15)
                if r.status_code == 200:
                    with open(fallback_font_path, 'wb') as f:
                        f.write(r.content)
                    print("Downloaded IPAexGothic font.")
                else:
                    raise Exception(f"Failed to download font: status {r.status_code}")
            except Exception as e:
                print(f"Failed to download fallback font: {e}")
                
        if os.path.exists(fallback_font_path):
            try:
                pdfmetrics.registerFont(TTFont('JapaneseFont', fallback_font_path))
                registered = True
                print("Registered downloaded font: ipaexg.ttf")
            except Exception as e:
                print(f"Failed to register downloaded font: {e}")
                
    if not registered:
        print("WARNING: No Japanese font registered. PDF may contain gibberish.")
        
    # 登録の成否にかかわらず、処理完了フラグを立てて二重処理を防ぎます
    IS_FONT_REGISTERED = True

# -------------------------------------------------------------------------
# 要望理由の自動翻訳マッピング定義
# -------------------------------------------------------------------------
# ユーザーが選択したカテゴリを、行政や警察へ提出するのにふさわしいフォーマルな文書表現にマッピングします。
CATEGORY_TRANSLATION = {
    'poor_visibility': {
        'title': '交差点・道路の見通し不良',
        'formal': '当該箇所（交差点・道路）は、建物や樹木等の遮蔽物が多く見通しが不良であり、歩行者および交差車両の視認性が極めて低いため、出合い頭の衝突事故が発生する危険性が非常に高い状態にあります。'
    },
    'heavy_traffic': {
        'title': '交通量の著しい過多',
        'formal': '当該道路は生活道路または通学路であるにもかかわらず、近年の交通状況の変化により抜け道として利用する車両が著しく増加しており、特に歩行者（高齢者および児童等）の安全が著しく脅かされております。'
    },
    'speeding': {
        'title': '車両の速度超過（スピード違反）',
        'formal': '当該道路は直線区間が長く、車両の走行速度が制限速度を大幅に超過する傾向が常態化しており、近隣住民および歩行者が常に交通事故の危険にさらされております。'
    },
    'no_sidewalk': {
        'title': '歩道の未整備',
        'formal': '当該道路は十分な歩行スペース（歩道）が確保されておらず、歩行者は車道の端を通行せざるを得ないため、車両との接触事故が発生する危険性が極めて高い状態で放置されております。'
    },
    'no_light': {
        'title': '信号機・横断歩道の未設置',
        'formal': '当該交差点は歩行者の横断需要および車両の通行量が多いにもかかわらず、信号機や横断歩道が設置されていないため、歩行者の安全な横断が著しく困難であり、事故が多発・常態化する危険性を孕んでおります。'
    },
    'other': {
        'title': 'その他交通安全上の懸念事項',
        'formal': '当該箇所において、安全な通行を妨げる重大な支障（路面の破損、標識の視認性不良、またはその他危険要因）が発生しており、早期の状況確認および対策が必要です。'
    }
}

# -------------------------------------------------------------------------
# 地図タイル座標計算 & ステッチャー処理
# -------------------------------------------------------------------------
def latlng_to_tile(lat, lng, zoom):
    """
    緯度経度およびズームレベルを、OpenStreetMapのタイル座標 (X, Y) に変換する数式関数。
    ※メルカトル投影法に基づきます。
    """
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    xtile = int((lng + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.log(math.tan(lat_rad) + (1.0 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return xtile, ytile

def tile_to_latlng(xtile, ytile, zoom):
    """
    指定されたタイル座標 (X, Y) の左上隅の緯度経度を算出する逆変換関数。
    ピクセル描画位置の線形補間に使用されます。
    """
    n = 2.0 ** zoom
    lng = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * ytile / n)))
    lat = math.degrees(lat_rad)
    return lat, lng

def generate_static_map(lat, lng, zoom=17, size=(500, 300)):
    """
    指定された緯度経度の周辺地図をOpenStreetMapタイルから生成する関数。
    1. 経緯度を中心とする3x3マス（計9枚）の地図画像タイル(256px)をダウンロードして結合(768px)。
    2. 指定座標のピクセルオフセット位置を計算し、赤いピンマーカーを描画。
    3. 指定サイズ(size)に合わせて中心付近を切り抜いて保存。
    """
    os.makedirs(os.path.join(DATA_DIR, 'maps'), exist_ok=True)
    map_image_path = os.path.join(DATA_DIR, 'maps', f'map_{lat}_{lng}_{zoom}.jpg')
    
    # 既に同じ座標の地図画像が生成済みの場合はキャッシュを返却
    if os.path.exists(map_image_path):
        return map_image_path
        
    try:
        # 中心タイルの座標を決定
        cx, cy = latlng_to_tile(lat, lng, zoom)
        
        # 3x3タイルの結合用キャンバスをPILで作成
        tile_width, tile_height = 256, 256
        stitched = Image.new('RGB', (tile_width * 3, tile_height * 3))
        
        # OSMタイルの利用規約に準拠したUser-Agentヘッダーを設定
        headers = {
            'User-Agent': 'AnzenRoad/1.0 (Local Civic-Tech Request Form App; Contact: anzenroad@example.com)'
        }
        
        # 周辺9枚のタイルを巡回してダウンロード・結合
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                tx = cx + dx
                ty = cy + dy
                url = f"https://tile.openstreetmap.org/{zoom}/{tx}/{ty}.png"
                
                try:
                    r = requests.get(url, headers=headers, timeout=5)
                    if r.status_code == 200:
                        tile = open_image_from_bytes(r.content)
                    else:
                        tile = Image.new('RGB', (tile_width, tile_height), '#f1f1f1')
                except Exception as e:
                    print(f"Failed to fetch tile {tx},{ty}: {e}")
                    tile = Image.new('RGB', (tile_width, tile_height), '#f1f1f1')
                
                # 正しいグリッド位置へタイルを貼り付け
                stitched.paste(tile, ((dx + 1) * tile_width, (dy + 1) * tile_height))
                
        # 結合画像内における実際の指定座標（ピン描画位置）のピクセル座標を算出
        clat, clng = tile_to_latlng(cx, cy, zoom) # 中心タイルの左上座標
        nlat, nlng = tile_to_latlng(cx + 1, cy + 1, zoom) # 次のタイルの左上座標
        
        # 線形補間によりピクセル位置を特定
        px = tile_width + int(((lng - clng) / (nlng - clng)) * tile_width)
        py = tile_height + int(((lat - clat) / (nlat - clat)) * tile_height)
        
        # 地図上に赤いピン型マーカーを描画
        draw = ImageDraw.Draw(stitched)
        marker_color = '#e11d48'
        r_circle = 12
        # ピンの頭部（円形）
        draw.ellipse([px - r_circle, py - r_circle - 10, px + r_circle, py + r_circle - 10], fill=marker_color, outline='white', width=2)
        # ピンの足（逆三角形）
        draw.polygon([px - 6, py - 3, px + 6, py - 3, px, py + 8], fill=marker_color, outline='white')
        # ピン中央の白いドット
        draw.ellipse([px - 4, py - r_circle - 4, px + 4, py - r_circle + 4], fill='white')
        
        # 描画したピンが中央にくるように指定サイズで切り抜く
        left = max(0, px - size[0] // 2)
        top = max(0, py - size[1] // 2)
        right = min(stitched.width, left + size[0])
        bottom = min(stitched.height, top + size[1])
        
        cropped = stitched.crop((left, top, right, bottom))
        cropped.save(map_image_path, 'JPEG', quality=85)
        return map_image_path
        
    except Exception as e:
        print(f"Error generating map image: {e}")
        # オフラインやネットワークエラー時のフォールバック処理（簡易位置図を生成）
        fallback_path = os.path.join(DATA_DIR, 'maps', 'map_fallback.jpg')
        if not os.path.exists(fallback_path):
            img = Image.new('RGB', size, '#e5e7eb')
            draw = ImageDraw.Draw(img)
            draw.text((20, 20), "Map display error (Check Network)", fill='#4b5563')
            draw.text((20, 40), f"Coords: {lat:.5f}, {lng:.5f}", fill='#4b5563')
            img.save(fallback_path, 'JPEG')
        return fallback_path

def open_image_from_bytes(data):
    """バイト配列から画像を読み込み、PILのImageオブジェクトを返却する補助関数。"""
    import io
    return Image.open(io.BytesIO(data))

# -------------------------------------------------------------------------
# 要望書PDFレイアウト生成エンジン
# -------------------------------------------------------------------------
def generate_request_pdf(data):
    """
    行政提出用の正式なA4フォーマット要望書PDFを動的に生成する関数。
    - data: 生成に必要な各種パラメータの辞書
      - date_str: 年月日
      - target_office_name: 宛先名称
      - requester_name, requester_address, requester_phone: 要望者の連絡先情報
      - address: 危険箇所の住所
      - danger_category: 危険種別コード
      - description: ユーザー入力の詳細説明文
      - latitude, longitude: 危険位置の座標
      - photo_path: (任意) ぼかし適用済みの現況写真のパス
    - 戻り値: 生成されたPDFファイルのパス
    """
    # 起動時の遅延を防ぐため、PDF生成要求があった時点で初めてフォント登録を行います（初回のみ実行）
    register_japanese_font()

    pdf_filename = f"request_{int(math.fabs(data.get('latitude', 0)) * 100000)}_{int(math.fabs(data.get('longitude', 0)) * 100000)}.pdf"
    pdf_path = os.path.join(DATA_DIR, pdf_filename)
    
    # ドキュメントの初期設定 (A4サイズ、余白各36ポイント = 0.5インチ = 約1.27cm)
    margin = 36
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin
    )
    
    # 登録した日本語フォントに対応した文字スタイルの設定
    styles = getSampleStyleSheet()
    
    # 大見出し用
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='JapaneseFont',
        fontSize=20,
        leading=24,
        alignment=1, # 中央揃え
        spaceAfter=20
    )
    
    # 標準段落用
    normal_style = ParagraphStyle(
        'DocNormal',
        parent=styles['Normal'],
        fontName='JapaneseFont',
        fontSize=10,
        leading=15,
        spaceAfter=6
    )
    
    # 右寄せ段落（日付・要望者情報）
    right_style = ParagraphStyle(
        'DocRight',
        parent=normal_style,
        alignment=2 # 右揃え
    )
    
    # 太字強調段落
    bold_style = ParagraphStyle(
        'DocBold',
        parent=normal_style,
        fontSize=11,
        leading=16,
        fontName='JapaneseFont'
    )
    
    # テーブルセル内段落
    cell_style = ParagraphStyle(
        'DocCell',
        parent=normal_style,
        fontSize=9.5,
        leading=14,
        spaceAfter=0
    )
    
    # テーブルヘッダーセル用段落
    cell_header_style = ParagraphStyle(
        'DocCellHeader',
        parent=cell_style,
        alignment=1, # 中央揃え
        spaceAfter=0
    )

    story = []
    
    # 1. 要望書の大見出しを追加
    story.append(Paragraph("道路・交通環境整備に関する要望書", title_style))
    story.append(Spacer(1, 10))
    
    # 2. 申請日を追加
    story.append(Paragraph(data.get('date_str', '令和8年6月9日'), right_style))
    story.append(Spacer(1, 5))
    
    # 3. 要望者（代表者）連絡先ブロックを追加（右寄せで配置するための透明テーブル）
    req_name = data.get('requester_name', '（省略）')
    req_addr = data.get('requester_address', '（省略）')
    req_phone = data.get('requester_phone', '（省略）')
    
    req_info_text = f"<b>要望者（代表者）:</b><br/>" \
                    f"住所: {req_addr}<br/>" \
                    f"氏名: {req_name} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;印<br/>" \
                    f"電話番号: {req_phone}"
    
    # 全体の印刷幅 523ポイントを割り振る
    req_table_data = [
        ["", Paragraph(req_info_text, normal_style)]
    ]
    req_table = Table(req_table_data, colWidths=[273, 250])
    req_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(req_table)
    story.append(Spacer(1, 15))
    
    # 4. 提出先（宛先）を追加
    target_office = data.get('target_office_name', '管轄自治体 / 警察署 御中')
    story.append(Paragraph(f"<b>{target_office}</b>", bold_style))
    story.append(Spacer(1, 15))
    
    # 5. 前文（要望趣旨）を追加
    intro_p = "日頃より地域の安全な交通環境の整備および防犯・防災対策にご尽力いただき、深く感謝申し上げます。<br/>" \
              "さて、下記に示す地域内道路におきまして、歩行者や車両が重大な交通事故に遭遇するおそれが極めて高い危険箇所が存在するため、早期の状況確認および対策（路面標示・看板の設置、路面修繕、見通し改善、安全対策等）の実施を強く要望いたします。"
    story.append(Paragraph(intro_p, normal_style))
    story.append(Spacer(1, 15))
    
    # 6. 要望内容の詳細テーブルを追加
    category_code = data.get('danger_category', 'other')
    category_info = CATEGORY_TRANSLATION.get(category_code, CATEGORY_TRANSLATION['other'])
    category_title = category_info['title']
    
    # 選択カテゴリに応じた正式な定型要望理由
    formal_reason = category_info['formal']
    user_desc = data.get('description', '')
    # ユーザーがテキストを入力していた場合は定型文に連結して表示
    if user_desc:
        reason_content = f"{formal_reason}<br/><br/><b>【具体的な状況・住民の声】</b><br/>{user_desc}"
    else:
        reason_content = formal_reason
        
    details_data = [
        [Paragraph("<b>要望事項</b>", cell_header_style), Paragraph(f"交通安全対策（{category_title}）の早期実施", cell_style)],
        [Paragraph("<b>危険箇所住所</b>", cell_header_style), Paragraph(data.get('address', '地図上の指定位置（座標参照）'), cell_style)],
        [Paragraph("<b>具体的な理由</b>", cell_header_style), Paragraph(reason_content, cell_style)],
    ]
    
    # テーブルのスタイル調整
    details_table = Table(details_data, colWidths=[90, 433])
    details_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#9ca3af')), # 薄いグレーの罫線
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f3f4f6')), # ヘッダー列の背景グレー
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 20))
    
    # 7. 添付資料ヘッダーを追加
    story.append(Paragraph("<b>【添付資料】位置図（地図）および現況写真</b>", bold_style))
    story.append(Spacer(1, 8))
    
    # 地図位置図のスナップショットを合成・取得
    lat = data.get('latitude', 35.6938)
    lng = data.get('longitude', 139.7034)
    map_img_path = generate_static_map(lat, lng, zoom=17, size=(480, 320))
    
    photo_path = data.get('photo_path')
    if photo_path and not os.path.exists(photo_path):
        photo_path = None
        
    # 写真がある場合は、地図位置図と現況写真を「左右横並び」で美しく配置
    # 写真がない場合は、「大きな地図のみ」を中央配置
    attachments_data = []
    if photo_path:
        # 地図画像の幅を約250ポイントにリサイズ（アスペクト比 1.5 -> 高さ166）
        map_img_flowable = RLImage(map_img_path, width=250, height=166)
        
        # ユーザー写真のアスペクト比を維持しながら縮小計算
        try:
            with Image.open(photo_path) as p_img:
                pw, ph = p_img.size
            ratio = pw / ph
            p_width = 250
            p_height = int(250 / ratio)
            # 縦幅がはみ出ないよう上限166にクリップ
            if p_height > 166:
                p_height = 166
                p_width = int(166 * ratio)
        except Exception as e:
            print(f"Error reading user photo: {e}")
            p_width = 250
            p_height = 166
            
        photo_img_flowable = RLImage(photo_path, width=p_width, height=p_height)
        
        attachments_data = [
            [Paragraph("<b>【位置図】付近見取図</b>", cell_header_style), Paragraph("<b>【現況写真】危険箇所の写真</b>", cell_header_style)],
            [map_img_flowable, photo_img_flowable]
        ]
        attachments_table = Table(attachments_data, colWidths=[261, 262])
    else:
        # 地図のみ配置
        map_img_flowable = RLImage(map_img_path, width=380, height=253)
        attachments_data = [
            [Paragraph("<b>【位置図】付近見取図（座標: 北緯 {:.5f}度 / 東経 {:.5f}度）</b>", cell_header_style)],
            [map_img_flowable]
        ]
        attachments_table = Table(attachments_data, colWidths=[523])
        
    attachments_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f9fafb')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    
    story.append(attachments_table)
    
    # ドキュメントのビルド実行
    doc.build(story)
    
    return pdf_path

if __name__ == '__main__':
    # PDF生成単体テストの実行コード
    test_data = {
        'date_str': '令和8年6月9日',
        'target_office_name': '新宿警察署長 殿',
        'requester_name': '日本 太郎',
        'requester_address': '東京都新宿区歌舞伎町1-1-1',
        'requester_phone': '090-1234-5678',
        'address': '東京都新宿区西新宿6丁目',
        'danger_category': 'poor_visibility',
        'description': 'この交差点は街路樹の枝が伸びており、カーブミラーも曇っているため右折車が対向車を視認することが難しく、非常に危険です。安全ミラーの交換や剪定を要望します。',
        'latitude': 35.6925,
        'longitude': 139.6961
    }
    
    pdf_out = generate_request_pdf(test_data)
    print("Test PDF successfully created at:", pdf_out)
