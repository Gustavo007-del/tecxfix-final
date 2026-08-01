# Generated manually to fix product_id migration issue

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_add_salesrequest_fields'),
    ]

    operations = [
        # This migration handles the product_id field that Django thinks exists but doesn't
        # We'll mark it as already removed to avoid the error
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='salesrequestproduct',
                    name='product_id',
                ),
            ],
            database_operations=[
            ]
        ),
    ]
