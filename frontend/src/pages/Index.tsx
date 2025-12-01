import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { MessageSquare, Users, Zap, ArrowRight, CheckCircle, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const features = [
    {
      icon: Users,
      title: "Smart Connection Analysis",
      description: "AI analyzes your LinkedIn connections' profiles to understand their interests and background"
    },
    {
      icon: MessageSquare,
      title: "Personalized Message Crafting",
      description: "Generate meaningful, contextual conversation starters based on mutual interests and goals"
    },
    {
      icon: Zap,
      title: "Topic-Focused Outreach",
      description: "Define what you want to discuss and get tailored messages for each connection"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">LinkedIn Advanced Search</span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-white">Welcome, {user.firstName || user.email}</span>
                  <Button onClick={handleGetStarted} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Dashboard
                  </Button>
                  <Button onClick={handleSignOut} variant="outline" className="bg-slate-700 border-white/20 text-white hover:bg-white/10">
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => navigate('/auth')} variant="ghost" className="text-white hover:bg-white/10">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                  <Button onClick={handleGetStarted} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Turn Your LinkedIn Network Into
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> Meaningful Conversations</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            AI-powered conversation starters that analyze your connections' profiles and craft personalized messages based on what you want to discuss.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleGetStarted}
              size="lg" 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg"
            >
              {user ? 'Go to Dashboard' : 'Start Networking Smarter'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              className="bg-slate-700 border-white/20 text-white hover:bg-white/10 px-8 py-3 text-lg"
            >
              See How It Works
            </Button>
            
          </div>
        </div>
      </div>

      {}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Intelligent Networking Made Simple
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Stop sending generic messages. Start having conversations that matter.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-300 text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-white/10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold text-white mb-6">
                Why LinkedIn Advanced Search Works
              </h3>
              <div className="space-y-4">
                {[
                  "Personalized messages get 3x higher response rates",
                  "Save hours of research time per connection",
                  "Build authentic professional relationships",
                  "Track conversation topics and outcomes"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <div>
                      <div className="text-white font-medium">Sarah Chen</div>
                      <div className="text-slate-400 text-sm">Product Manager at TechCorp</div>
                    </div>
                  </div>
                  <div className="bg-blue-600/20 rounded-lg p-4">
                    <p className="text-white text-sm">
                      "Hi Sarah! I noticed your recent post about AI in product development. As someone working on similar challenges in the fintech space, I'd love to hear your thoughts on..."
                    </p>
                  </div>
                  <div className="text-slate-400 text-xs">✨ Generated based on recent activity and mutual interests</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Transform Your Networking?
        </h3>
        <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
          Join professionals who are building meaningful connections with AI-powered conversation starters.
        </p>
        <Button 
          onClick={handleGetStarted}
          size="lg" 
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg"
        >
          {user ? 'Go to Dashboard' : 'Get Started for Free'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {}
      <footer className="bg-white/5 backdrop-blur-md border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-6 w-6 text-blue-400" />
              <span className="text-white font-semibold">LinkedIn Advanced Search</span>
            </div>
            <div className="text-slate-400 text-sm text-center">
              © 2025 LinkedIn Advanced Search. Some stuff from <a href="https://github.com/hatmanstack" className="text-red-400">Hatman</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
