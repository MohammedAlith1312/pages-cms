"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { handleGithubSignIn, handleEmailSignIn } from "@/lib/actions/auth";
import { toast } from "sonner";
import { Github, Loader2 } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";

export function SignIn() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "";
  const redirectTo = searchParams.get("redirect") || "/";
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [emailState, emailAction] = useFormState(handleEmailSignIn, null);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setIsGithubLoading(false);
    }
  }, [error]);

  useEffect(() => {
    if (emailState?.error) {
      toast.error(emailState.error);
    } else if (emailState?.message) {
      toast.success(emailState.message);
    }
  }, [emailState]);

  const onGithubLogin = async () => {
    setIsGithubLoading(true);
    await handleGithubSignIn(redirectTo);
  };

  return (
    <div className="official-login-wrapper">
      <div className="login-inner">
        <h1 className="login-title">Sign in to Pages CMS</h1>

        <div className="login-content">
          <button
            onClick={onGithubLogin}
            disabled={isGithubLoading}
            className="auth-button github-primary"
          >
            {isGithubLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Github className="h-5 w-5 mr-2 fill-current" />
            )}
            <span>Sign in with GitHub</span>
          </button>

          <div className="auth-divider">
            <span className="divider-text">OR</span>
          </div>

          <form action={emailAction} className="email-auth-form">
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              className="auth-input"
            />
            <EmailSubmitButton />
          </form>

          <p className="auth-legal">
            By clicking continue, you agree to our <a href="#">Terms of Service</a> <br />
            and <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>

      <style jsx global>{`
        .official-login-wrapper {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111827;
        }

        .login-inner {
          width: 100%;
          max-width: 360px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .login-title {
          font-size: 26px;
          font-weight: 600;
          margin-bottom: 32px;
          letter-spacing: -0.025em;
        }

        .login-content {
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .auth-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 11px;
          background: #111111;
          color: #ffffff;
          border-radius: 8px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .auth-button:hover {
          background: #222222;
        }

        .auth-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .auth-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          color: #e5e7eb;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: currentColor;
        }

        .divider-text {
          padding: 0 12px;
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
        }

        .email-auth-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .auth-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
        }

        .auth-input:focus {
          border-color: #9ca3af;
        }

        .auth-input::placeholder {
          color: #9ca3af;
        }

        .auth-legal {
          margin-top: 24px;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.6;
          text-align: center;
        }

        .auth-legal a {
          color: #374151;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

function EmailSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="auth-button"
      style={{ marginTop: '4px' }}
    >
      {pending ? "Sending..." : "Sign in with email"}
    </button>
  );
}
