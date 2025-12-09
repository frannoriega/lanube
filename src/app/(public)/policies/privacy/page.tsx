"use client";
import PrivacyPolicy from "@/assets/policies/privacy.mdx";
import Container from "@/components/atoms/container";

export default function PrivacyPolicyPage() {
  return (
    <Container className="h-fit">
      <div className="h-fit flex flex-col gap-8 my-12 bg-slate-200/30 dark:bg-slate-900/30 backdrop-blur-sm p-4 rounded-xl mx-8">
        <div className="flex flex-col gap-4">
          <div className="markdown flex flex-col gap-4">
            <PrivacyPolicy />
          </div>
        </div>
      </div>
    </Container>
  );
}
