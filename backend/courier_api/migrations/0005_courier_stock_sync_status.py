from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('courier_api', '0004_alter_couriertransaction_created_by'),
    ]

    operations = [
        migrations.AlterField(
            model_name='couriertransaction',
            name='status',
            field=models.CharField(
                choices=[('in_transit', 'In Transit'), ('sent', 'Sent and stock updated'), ('received', 'Received')],
                default='in_transit',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='couriertransaction',
            name='stock_sync_status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('in_progress', 'In progress'), ('complete', 'Complete'), ('failed', 'Failed')],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='couriertransaction',
            name='stock_sync_error',
            field=models.TextField(blank=True),
        ),
    ]
