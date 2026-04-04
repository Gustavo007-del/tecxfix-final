# Generated manually to add sales models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_processedcomplaint_existing'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('DIRECT', 'Direct'), ('COMPLIANT', 'Compliant')], default='DIRECT', max_length=20)),
                ('company_name', models.CharField(max_length=200)),
                ('compliant_number', models.CharField(blank=True, max_length=50, null=True)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')], default='PENDING', max_length=20)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('admin_notes', models.TextField(blank=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='approved_sales_requests', to=settings.AUTH_USER_MODEL)),
                ('technician', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='sales_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Sales Request',
                'verbose_name_plural': 'Sales Requests',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.CreateModel(
            name='SalesRequestProduct',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_id', models.IntegerField()),
                ('product_name', models.CharField(max_length=200)),
                ('product_code', models.CharField(max_length=50)),
                ('quantity', models.IntegerField()),
                ('mrp', models.DecimalField(decimal_places=2, max_digits=10)),
                ('service_charge', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('sales_request', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='products', to='api.salesrequest')),
            ],
            options={
                'verbose_name': 'Sales Request Product',
                'verbose_name_plural': 'Sales Request Products',
            },
        ),
    ]
