# Firebase 設定模組
import os
import json
import base64
import firebase_admin
from firebase_admin import credentials, db

# Firebase 初始化狀態
_firebase_initialized = False

def init_firebase():
    """初始化 Firebase Admin SDK"""
    global _firebase_initialized
    
    if _firebase_initialized:
        return True
    
    try:
        # 方式 1: 從環境變數讀取 Base64 編碼的憑證
        firebase_creds_b64 = os.environ.get('FIREBASE_CREDENTIALS')
        if firebase_creds_b64:
            creds_json = base64.b64decode(firebase_creds_b64).decode('utf-8')
            creds_dict = json.loads(creds_json)
            cred = credentials.Certificate(creds_dict)
        else:
            # 方式 2: 從本地檔案讀取（開發用）
            creds_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'firebase-credentials.json'
            )
            if os.path.exists(creds_file):
                cred = credentials.Certificate(creds_file)
            else:
                print("⚠️ Firebase 憑證未找到，使用本地 JSON 儲存")
                return False
        
        # 從憑證中取得專案 ID 來建立資料庫 URL
        project_id = cred.project_id if hasattr(cred, 'project_id') else creds_dict.get('project_id')
        database_url = f"https://{project_id}-default-rtdb.asia-southeast1.firebasedatabase.app"
        
        firebase_admin.initialize_app(cred, {
            'databaseURL': database_url
        })
        
        _firebase_initialized = True
        print(f"[OK] Firebase initialized: {project_id}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Firebase init failed: {e}")
        return False

def get_firebase_ref(path: str):
    """取得 Firebase 資料庫參考"""
    if not _firebase_initialized:
        if not init_firebase():
            return None
    return db.reference(path)
