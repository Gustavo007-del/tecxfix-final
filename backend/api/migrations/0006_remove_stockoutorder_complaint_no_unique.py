from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_alter_stockreceived_complaint_no'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stockoutorder',
            name='complaint_no',
            field=models.CharField(max_length=100, unique=False),
        ),
    ]
