import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { MessageSquare, ArrowLeft, Eye, EyeOff, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useToast } from '@/shared/hooks';
import { isCognitoConfigured } from '@/config/appConfig';

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, confirmSignUp, resendConfirmationCode } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });
  
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });

  const [verificationData, setVerificationData] = useState({
    code: ''
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreloading) setIsPreloading(false);
    setIsLoading(true);
    
    try {
      const { error } = await signIn(signInData.email, signInData.password);
      
      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message || "Invalid credentials",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully."
        });
        navigate('/dashboard');
      }
    } catch {
      toast({
        title: "Sign In Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const result = await signUp(
        signUpData.email, 
        signUpData.password, 
        signUpData.firstName, 
        signUpData.lastName
      );
      
      if (result.error) {
        toast({
          title: "Sign Up Failed",
          description: result.error.message || "Registration failed",
          variant: "destructive"
        });
      } else {
        if (isCognitoConfigured) {
          setVerificationEmail(signUpData.email);
          setShowVerification(true);
          toast({
            title: "Check Your Email",
            description: "We've sent you a verification code. Please check your email and enter the code below."
          });
        } else {
          toast({
            title: "Welcome!",
            description: "Your account has been created successfully."
          });
          navigate('/dashboard');
        }
      }
    } catch {
      toast({
        title: "Sign Up Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmSignUp) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await confirmSignUp(verificationEmail, verificationData.code);
      
      if (error) {
        toast({
          title: "Verification Failed",
          description: error.message || "Invalid verification code",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email Verified!",
          description: "Your account has been verified. You can now sign in."
        });
        setShowVerification(false);
        setVerificationData({ code: '' });
      }
    } catch {
      toast({
        title: "Verification Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!resendConfirmationCode) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await resendConfirmationCode(verificationEmail);
      
      if (error) {
        toast({
          title: "Resend Failed",
          description: error.message || "Failed to resend verification code",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Code Sent",
          description: "A new verification code has been sent to your email."
        });
      }
    } catch {
      toast({
        title: "Resend Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        {}
        <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowVerification(false)}
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-8 w-8 text-blue-400" />
                  <span className="text-2xl font-bold text-white">LinkedIn Advanced Search</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <Mail className="h-16 w-16 text-blue-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">Verify Your Email</h1>
              <p className="text-slate-300">
                We've sent a verification code to <strong>{verificationEmail}</strong>
              </p>
            </div>

            <Card className="bg-white/5 backdrop-blur-md border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Enter Verification Code</CardTitle>
                <CardDescription className="text-slate-300">
                  Check your email and enter the 6-digit code below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerification} className="space-y-4">
                  <div>
                    <Label htmlFor="verification-code" className="text-white">Verification Code</Label>
                    <Input
                      id="verification-code"
                      value={verificationData.code}
                      onChange={(e) => setVerificationData(prev => ({ ...prev, code: e.target.value }))}
                      className="bg-white/5 border-white/20 text-white placeholder-slate-400 text-center text-lg tracking-widest"
                      placeholder="000000"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    disabled={isLoading || verificationData.code.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify Email'}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full border-white/20 text-white hover:bg-white/10"
                    onClick={handleResendCode}
                    disabled={isLoading}
                  >
                    Resend Code
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-8 w-8 text-blue-400" />
                <span className="text-2xl font-bold text-white">LinkedIn Advanced Search</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome</h1>
            <p className="text-slate-300">Sign in to your account or create a new one</p>
            {!isCognitoConfigured && (
              <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-200 text-sm">
                  <strong>Demo Mode:</strong> Using mock authentication. Configure AWS Cognito for production.
                </p>
              </div>
            )}
          </div>

          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 border-white/10">
                <TabsTrigger value="signin" className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <CardHeader>
                  <CardTitle className="text-white">Sign In</CardTitle>
                  <CardDescription className="text-slate-300">
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <Label htmlFor="signin-email" className="text-white">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInData.email}
                        onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-white/5 border-white/20 text-white placeholder-slate-400"
                        placeholder="your-email@example.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="signin-password" className="text-white">Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          value={signInData.password}
                          onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                          className="bg-white/5 border-white/20 text-white placeholder-slate-400 pr-10"
                          placeholder="••••••••"
                          required
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                      disabled={isLoading}
                      aria-busy={isLoading || isPreloading}
                      onMouseDown={() => setIsPreloading(true)}
                    >
                      {(isPreloading || isLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
                      {(isPreloading || isLoading) ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>

              <TabsContent value="signup">
                <CardHeader>
                  <CardTitle className="text-white">Create Account</CardTitle>
                  <CardDescription className="text-slate-300">
                    Create a new account to get started
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="signup-firstname" className="text-white">First Name</Label>
                        <Input
                          id="signup-firstname"
                          value={signUpData.firstName}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, firstName: e.target.value }))}
                          className="bg-white/5 border-white/20 text-white placeholder-slate-400"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <Label htmlFor="signup-lastname" className="text-white">Last Name</Label>
                        <Input
                          id="signup-lastname"
                          value={signUpData.lastName}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, lastName: e.target.value }))}
                          className="bg-white/5 border-white/20 text-white placeholder-slate-400"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="signup-email" className="text-white">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-white/5 border-white/20 text-white placeholder-slate-400"
                        placeholder="your-email@example.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-password" className="text-white">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          value={signUpData.password}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                          className="bg-white/5 border-white/20 text-white placeholder-slate-400 pr-10"
                          placeholder="••••••••"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
