# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, send_file, send_from_directory
import os
import sys
import datetime

# backendディレクトリをインポート検索パスに追加
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, save_spot, get_all_spots, find_closest_jurisdiction
from pdf_generator import generate_request_pdf

# Flaskアプリケーションの初期設定
app = Flask(__name__, static_folder='static', static_url_path='')

# 各種アップロード画像の保存先フォルダ設定
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'data', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# アプリ起動時にデータベースを初期化・接続準備
init_db()

@app.route('/')
def index():
    """
    ルートパスへのアクセス時に、フロントエンドのメインHTMLファイル (SPA) を返却します。
    """
    return app.send_static_file('index.html')

@app.route('/api/spots', methods=['GET'])
def api_get_spots():
    """
    登録されているすべての危険箇所をJSON形式で返却するAPI。
    地図上に青いピンを表示するために使用されます。
    """
    try:
        spots = get_all_spots()
        return jsonify(spots), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/spots', methods=['POST'])
def api_save_spot():
    """
    危険箇所レポートを新規登録するAPI。
    - 添付写真画像(photo)がある場合はタイムスタンプを付与して保存。
    - 各パラメータをパースし、SQLiteへ登録。
    """
    try:
        # 写真ファイルのアップロード処理
        photo_path = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename:
                # ファイル名の重複を防ぐため年月日時分秒を接頭辞として付与
                filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(save_path)
                photo_path = save_path
                
        # 送信されたフォームデータを取得
        data = request.form.to_dict()
        
        # 緯度・経度・危険レベルをキャスト
        latitude = float(data.get('latitude', 0))
        longitude = float(data.get('longitude', 0))
        danger_level = int(data.get('danger_level', 1))
        
        spot_data = {
            'latitude': latitude,
            'longitude': longitude,
            'address': data.get('address'),
            'target_type': data.get('target_type', 'mayor'),
            'danger_category': data.get('danger_category', 'other'),
            'danger_level': danger_level,
            'description': data.get('description', ''),
            'requester_name': data.get('requester_name', ''),
            'requester_address': data.get('requester_address', ''),
            'requester_phone': data.get('requester_phone', ''),
            'photo_path': photo_path
        }
        
        # データベースにレコードを保存
        spot_id = save_spot(spot_data)
        return jsonify({'id': spot_id, 'message': 'Spot saved successfully'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/resolve-jurisdiction', methods=['POST'])
def api_resolve_jurisdiction():
    """
    送信された緯度経度から、最寄りの管轄（区役所や警察署）を割り出して返却するAPI。
    """
    try:
        data = request.get_json() or {}
        lat = float(data.get('latitude', 0))
        lng = float(data.get('longitude', 0))
        target_type = data.get('target_type', 'mayor')
        
        # 最も近い距離にある対象種別の管轄窓口を取得
        jurisdiction = find_closest_jurisdiction(lat, lng, target_type)
        if jurisdiction:
            return jsonify(jurisdiction), 200
        else:
            # データベースから取得できなかった場合のフォールバックデータ
            fallback = {
                'name': '管轄警察署・自治体窓口 (検証中)',
                'address': '最寄りの窓口の情報を取得できませんでした。手動で検索してください。',
                'phone': 'N/A',
                'online_url': '#',
                'latitude': lat,
                'longitude': lng
            }
            return jsonify(fallback), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-pdf', methods=['POST'])
def api_generate_pdf():
    """
    要望書データを取得し、ReportLabエンジンを通してA4 PDFをオンデマンド生成して返却するAPI。
    """
    try:
        # 送信されたフォームデータを取得
        data = request.form.to_dict()
        
        # プレビュー時の一時写真アップロード処理
        photo_path = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename:
                filename = f"tmp_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
                photo_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(photo_path)
        elif data.get('photo_path'):
            # 既に保存されている写真パスがある場合は再利用
            photo_path = data.get('photo_path')

        # 提出書類の和暦（令和）での日付文字列を作成
        now = datetime.datetime.now()
        reiwa_year = now.year - 2018
        date_str = f"令和{reiwa_year}年{now.month}月{now.day}日"

        pdf_data = {
            'date_str': date_str,
            'target_office_name': data.get('target_office_name', '管轄自治体 / 警察署 御中'),
            'requester_name': data.get('requester_name', '（要望者）'),
            'requester_address': data.get('requester_address', '（住所）'),
            'requester_phone': data.get('requester_phone', '（電話番号）'),
            'address': data.get('address', '地図上の指定位置'),
            'danger_category': data.get('danger_category', 'other'),
            'description': data.get('description', ''),
            'latitude': float(data.get('latitude', 0)),
            'longitude': float(data.get('longitude', 0)),
            'photo_path': photo_path
        }

        # PDFドキュメントの生成を実行
        generated_pdf_path = generate_request_pdf(pdf_data)
        
        # 生成されたPDFバイナリデータをダウンロード用レスポンスとして送信
        return send_file(
            generated_pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='要望書.pdf'
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    """
    アップロードされた現況写真をフロントエンドで表示するための配信用ルート。
    """
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # 外部ホスト接続(host='0.0.0.0')を許可し、同一Wi-Fi内のスマートフォンからのテストを可能にします。
    app.run(host='0.0.0.0', port=5000, debug=True)
