import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Upload, FileText, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const Start = () => {
  const [consentGiven, setConsentGiven] = useState(false);
  const navigate = useNavigate();

  const handleMethodSelect = (method: string) => {
    if (!consentGiven) return;
    navigate(`/${method}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Start Your Inventory</h1>
        </div>

        {/* Consent Section */}
        <Card className="mb-8 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Privacy & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We use AI to analyze your photos/videos to identify household items. Your data is:
            </p>
            <ul className="text-muted-foreground space-y-1 ml-4">
              <li>• Processed securely and encrypted</li>
              <li>• Automatically deleted after 30 days</li>
              <li>• Never shared with third parties</li>
              <li>• Used only for inventory generation</li>
            </ul>
            
            <div className="flex items-center space-x-2 pt-4">
              <Checkbox 
                id="consent" 
                checked={consentGiven}
                onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
              />
              <label htmlFor="consent" className="text-sm">
                I agree to the processing of my data and accept the{" "}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                {" "}and{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Input Method Selection */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6 text-center">Choose Your Input Method</h2>
          <p className="text-muted-foreground text-center mb-8">
            You can combine methods—add more data later in the process.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !consentGiven ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => handleMethodSelect('upload')}
            >
              <CardContent className="p-6 text-center">
                <Camera className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Upload Photos</h3>
                <p className="text-muted-foreground mb-4">
                  Take photos of your rooms and items. Best for detailed inventory.
                </p>
                <Button 
                  className="w-full" 
                  disabled={!consentGiven}
                  variant={consentGiven ? "default" : "secondary"}
                >
                  Choose Photos
                </Button>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !consentGiven ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => handleMethodSelect('video')}
            >
              <CardContent className="p-6 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Upload Video</h3>
                <p className="text-muted-foreground mb-4">
                  Record a walkthrough video. Quick way to capture everything.
                </p>
                <Button 
                  className="w-full" 
                  disabled={!consentGiven}
                  variant={consentGiven ? "default" : "secondary"}
                >
                  Choose Video
                </Button>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !consentGiven ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => handleMethodSelect('manual')}
            >
              <CardContent className="p-6 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Manual List</h3>
                <p className="text-muted-foreground mb-4">
                  Type in your items manually. Full control over your inventory.
                </p>
                <Button 
                  className="w-full" 
                  disabled={!consentGiven}
                  variant={consentGiven ? "default" : "secondary"}
                >
                  Manual Entry
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Start;