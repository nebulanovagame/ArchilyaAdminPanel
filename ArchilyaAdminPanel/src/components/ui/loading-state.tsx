import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Yükleniyor..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
      <p className="text-xs font-sans text-gray-500 uppercase tracking-widest">
        {message}
      </p>
    </div>
  );
}
