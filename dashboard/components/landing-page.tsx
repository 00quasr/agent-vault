"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { ArrowRight, Shield, Lock, Zap, Check } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-gray-900" />
              <span className="text-lg font-semibold text-gray-900">Agent Vault</span>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-6 pt-24 pb-16">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-sm text-gray-600">
            <Shield className="h-3 w-3" />
            Verifiable Credential & Reputation Management
          </div>

          <h1 className="text-6xl font-bold tracking-tight text-gray-900">
            Trustless Agent
            <br />
            Verification System
          </h1>

          <p className="text-xl text-gray-600 leading-relaxed">
            Build reputation for AI agents through verifiable credentials.
            Prove capabilities and track performance without revealing sensitive data.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <WalletButton />
            <Link href="/agents">
              <Button variant="outline" className="gap-2">
                View Demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-7xl px-6 py-24 border-t border-gray-200">
        <div className="grid md:grid-cols-3 gap-12">
          <Feature
            icon={<Shield className="h-6 w-6" />}
            title="Verifiable Credentials"
            description="Issue tamper-proof credentials on Midnight blockchain. Each agent builds a verifiable track record of capabilities and performance."
          />
          <Feature
            icon={<Lock className="h-6 w-6" />}
            title="Reputation Management"
            description="Track agent performance and authorization history. Build trust through cryptographically verified achievements."
          />
          <Feature
            icon={<Zap className="h-6 w-6" />}
            title="Privacy-Preserving Verification"
            description="Prove capabilities without exposing sensitive data. Zero-knowledge proofs enable trustless verification."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-7xl px-6 py-24 border-t border-gray-200">
        <div className="space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-gray-900">How It Works</h2>
            <p className="text-lg text-gray-600">
              Build trust through verifiable credentials and reputation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Step
              number="1"
              title="Issue Verifiable Credential"
              description="Create an immutable credential on Midnight blockchain. Each credential represents verified capabilities or achievements."
            />
            <Step
              number="2"
              title="Build Reputation"
              description="Track successful authorizations and task completions. Performance history builds agent trustworthiness over time."
            />
            <Step
              number="3"
              title="Verify & Prove"
              description="Agents prove credentials via zero-knowledge proofs. Verify capabilities without exposing sensitive implementation details."
            />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mx-auto max-w-7xl px-6 py-24 border-t border-gray-200">
        <div className="max-w-2xl space-y-8">
          <h2 className="text-4xl font-bold text-gray-900">Verification & Reputation Use Cases</h2>
          <div className="space-y-4">
            <UseCase text="Agent marketplaces requiring verified credentials and reputation scores" />
            <UseCase text="Enterprise compliance with auditable authorization trails" />
            <UseCase text="Multi-agent systems establishing trust through performance history" />
            <UseCase text="Capability attestation without revealing proprietary implementations" />
            <UseCase text="Reputation-based access control for autonomous systems" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 border-t border-gray-200">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-gray-900">
            Start Building Verifiable Agent Reputation
          </h2>
          <p className="text-lg text-gray-600">
            Issue credentials, track performance, and build trustless verification systems
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Agent Vault</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://midnight.network"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 transition-colors"
              >
                Midnight Network
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-gray-900">{icon}</div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-900 bg-white">
        <span className="text-lg font-bold text-gray-900">{number}</span>
      </div>
      <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function UseCase({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
        <Check className="h-3 w-3 text-white" />
      </div>
      <p className="text-gray-700">{text}</p>
    </div>
  );
}
