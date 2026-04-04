# Generated manually to track existing ProcessedComplaint table
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_remove_stockoutorder_complaint_no_unique'),
    ]

    operations = [
        # Use RunPython to mark existing table as tracked
        migrations.RunPython(
            code='def create_processed_complaint_table(apps, schema_editor):\n    pass',
            reverse_code=migrations.RunPython.noop
        ),
    ]
