from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('courier_api', '0007_push_device_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='couriertransaction',
            name='submission_fingerprint',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
    ]
