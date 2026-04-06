import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Check api tables
cursor.execute('SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "%api%"')
api_tables = [row[0] for row in cursor.fetchall()]
print("API tables:", api_tables)

# Check migration history
cursor.execute('SELECT app, name FROM django_migrations WHERE app="api" ORDER BY id')
applied_migrations = [row[1] for row in cursor.fetchall()]
print("Applied migrations:", applied_migrations)

conn.close()
