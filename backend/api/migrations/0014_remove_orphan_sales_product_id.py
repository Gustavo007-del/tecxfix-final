"""Finish the database half of 0009's state-only product_id removal.

Some live databases may have had the column removed manually already, so this
must be conditional. New installs otherwise cannot create sales request lines.
"""
from django.db import migrations


def remove_orphan_column(apps, schema_editor):
    table = 'api_salesrequestproduct'
    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name for column in schema_editor.connection.introspection.get_table_description(
                cursor, table,
            )
        }
    if 'product_id' in columns:
        quoted = schema_editor.quote_name
        schema_editor.execute(
            f'ALTER TABLE {quoted(table)} DROP COLUMN {quoted("product_id")}'
        )


class Migration(migrations.Migration):
    dependencies = [('api', '0013_stockoperation_complaintprocessingrun')]

    operations = [migrations.RunPython(remove_orphan_column, migrations.RunPython.noop)]
