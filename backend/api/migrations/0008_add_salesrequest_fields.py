# Generated manually to fix migration issues

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_processedcomplaint_salesrequest_salesrequestproduct'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesrequest',
            name='invoice_number',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='salesrequest',
            name='customer_name',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='salesrequest',
            name='remarks',
            field=models.TextField(blank=True, null=True),
        ),
    ]
