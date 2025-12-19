from django.test import TestCase
from django.contrib.auth.models import User
from .models import Stock, Courier, CourierItem

class StockTestCase(TestCase):
    def setUp(self):
        Stock.objects.create(
            spare_id='SKU001',
            spare_name='Item 1',
            brand_name='Brand A',
            mrp=500,
            quantity_available=100
        )

    def test_stock_creation(self):
        stock = Stock.objects.get(spare_id='SKU001')
        self.assertEqual(stock.spare_name, 'Item 1')

class CourierTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('admin', 'admin@test.com', 'password')
        self.stock = Stock.objects.create(
            spare_id='SKU001',
            spare_name='Item 1',
            brand_name='Brand A',
            mrp=500,
            quantity_available=100
        )

    def test_courier_creation(self):
        courier = Courier.objects.create(
            courier_id='CUR-20251213-TEST',
            created_by=self.user,
            status='CREATED'
        )
        self.assertEqual(courier.status, 'CREATED')
