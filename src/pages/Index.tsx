import { Button } from "@/components/ui/button";
import { Camera, Upload, FileText, Shield, Clock, Download } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            AI Move Inventory
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create a complete household inventory in minutes. Upload photos, videos, or list manually. 
            Get instant volume and weight estimates with a professional PDF report.
          </p>
          
          <Link to="/start">
            <Button size="lg" className="text-lg px-8 py-6 mb-12">
              Start Your Inventory
            </Button>
          </Link>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-16">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Privacy First</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Ready in Minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Professional PDF</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Capture</h3>
              <p className="text-muted-foreground">
                Upload photos, videos, or manually list your items. Mix and match methods as needed.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. AI Analysis</h3>
              <p className="text-muted-foreground">
                Our AI identifies items, estimates volumes and weights, and organizes everything by room.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Get Report</h3>
              <p className="text-muted-foreground">
                Download your professional PDF report and share with moving companies.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Input Methods */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Choose Your Method</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="border rounded-lg p-6 text-center hover:shadow-md transition-shadow">
            <Camera className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-semibold mb-2">Upload Photos</h3>
            <p className="text-muted-foreground mb-4">
              Take photos of your rooms and items. Our AI will identify everything automatically.
            </p>
            <Button variant="outline" className="w-full">Best for Most</Button>
          </div>
          <div className="border rounded-lg p-6 text-center hover:shadow-md transition-shadow">
            <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-semibold mb-2">Upload Video</h3>
            <p className="text-muted-foreground mb-4">
              Record a walkthrough video. Perfect for getting everything in one go.
            </p>
            <Button variant="outline" className="w-full">Quick & Easy</Button>
          </div>
          <div className="border rounded-lg p-6 text-center hover:shadow-md transition-shadow">
            <FileText className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-semibold mb-2">Manual List</h3>
            <p className="text-muted-foreground mb-4">
              Type in your items manually. Great for those who prefer control.
            </p>
            <Button variant="outline" className="w-full">Full Control</Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 AI Move Inventory. Secure, private, and free to use.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
