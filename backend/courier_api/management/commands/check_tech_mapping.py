from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from courier_api.models import TechnicianStock

class Command(BaseCommand):
    help = 'Check technician to sheet name mapping'

    def handle(self, *args, **kwargs):
        techs = User.objects.filter(is_staff=False)
        
        self.stdout.write("\n=== Technician Sheet Mapping ===\n")
        
        for tech in techs:
            stock = TechnicianStock.objects.filter(technician=tech).first()
            sheet_name = stock.sheet_technician_name if stock else "NOT SET"
            
            self.stdout.write(
                f"ID: {tech.id} | Username: {tech.username} | "
                f"Sheet Name: {sheet_name}"
            )