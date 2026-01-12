-- Concordia Shrine データベースセットアップスクリプト
-- このスクリプトは、MySQLデータベースを作成し、必要な権限を設定します。

-- データベースの作成
CREATE DATABASE IF NOT EXISTS concordia 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- データベースの使用
USE concordia;

-- ユーザーの作成（オプション: 本番環境では専用ユーザーを作成することを推奨）
-- CREATE USER IF NOT EXISTS 'concordia'@'localhost' IDENTIFIED BY 'your-password-here';
-- GRANT ALL PRIVILEGES ON concordia.* TO 'concordia'@'localhost';
-- FLUSH PRIVILEGES;

-- データベースが正常に作成されたことを確認
SELECT 'Database "concordia" created successfully!' AS message;

