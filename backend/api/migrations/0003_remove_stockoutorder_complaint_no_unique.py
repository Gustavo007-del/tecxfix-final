from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_stockoutorder_stockreceived'),  # Reference the latest migration
    ]

    operations = [
        migrations.AlterField(
            model_name='stockoutorder',
            name='complaint_no',
            field=models.CharField(max_length=100, unique=False),
        ),
    ]
