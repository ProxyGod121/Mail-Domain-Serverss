import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({
    query: { retry: false, queryKey: getGetMeQueryKey() },
  });

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setLocation("/inbox");
    } else {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
