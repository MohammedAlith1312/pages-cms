"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { handleGithubSignIn } from "@/lib/actions/auth";
import { toast } from "sonner";
import { Github, FileText, Info, Loader2 } from "lucide-react";

export function SignIn() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "";
  const redirectTo = searchParams.get("redirect") || "/";
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setIsLoading(false);
    }
  }, [error]);

  const onLogin = async () => {
    setIsLoading(true);
    await handleGithubSignIn(redirectTo);
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">
              <FileText className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="login-logo-text">Docs</span>
          </div>

          <p className="login-subheading text-center">Sign in to access the official documentation portal</p>

          <div className="divider-line"></div>

          <form action={onLogin} className="w-full">
            <button
              type="submit"
              className={`github-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-3" />
              ) : (
                <Github className="h-5.5 w-5.5 mr-3" strokeWidth={2} />
              )}
              <span className="btn-text">Continue with GitHub</span>
            </button>
          </form>

          <div className="info-box">
            <Info className="h-4 w-4 text-[#386dff] mt-0.5 shrink-0" />
            <p>Only authorized users can access the document</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-wrapper {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e3e5e7;
          background-image:
              radial-gradient(ellipse at 20% 50%, rgba(56, 109, 255, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%);
          overflow: hidden;
          position: relative;
        }

        .login-wrapper::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image:
                linear-gradient(rgba(13, 127, 242, 0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
            background-size: 60px 60px;
            animation: gridMove 20s linear infinite;
        }

        @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(60px, 60px); }
        }

        .login-container {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 420px;
            padding: 20px;
        }

        .login-card {
            background: rgba(25, 59, 105, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 48px 40px;
            box-shadow:
                0 0 0 1px rgba(255, 255, 255, 0.03),
                0 20px 60px rgba(0, 0, 0, 0.4),
                0 0 80px rgba(56, 109, 255, 0.04);
            animation: cardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        @keyframes cardIn {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.96);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .login-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 15px;
        }

        .login-logo-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #386dff, #8b5cf6);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 16px rgba(56, 109, 255, 0.3);
        }

        .login-logo-text {
            font-size: 24px;
            font-weight: 800;
            color: #f0f6fc;
            letter-spacing: -0.02em;
        }

        .login-subheading {
            font-size: 14px;
            color: #ffffff99;
            margin-bottom: 32px;
            line-height: 1.5;
            max-width: 240px;
        }

        .divider-line {
            width: 100%;
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
            margin-bottom: 28px;
        }

        .github-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 14px 24px;
            background: #f0f6fc;
            color: #1a1a1a;
            border: none;
            border-radius: 12px;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .github-btn:hover {
            transform: translateY(-2px);
            background: #ffffff;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .github-btn:active {
            transform: translateY(0);
        }

        .github-btn.loading {
            opacity: 0.8;
            cursor: not-allowed;
        }

        .info-box {
            margin-top: 28px;
            background: rgba(56, 109, 255, 0.1);
            border: 1px solid rgba(56, 109, 255, 0.2);
            border-radius: 12px;
            padding: 14px 16px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            width: 100%;
        }

        .info-box p {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
