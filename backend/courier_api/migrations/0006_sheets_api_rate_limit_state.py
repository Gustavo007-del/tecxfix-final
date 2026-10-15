from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('courier_api', '0005_courier_stock_sync_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='SheetsApiRateLimitState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('next_allowed_at', models.DateTimeField()),
            ],
            options={
                'verbose_name': 'Google Sheets API rate limit state',
            },
        ),
    ]
