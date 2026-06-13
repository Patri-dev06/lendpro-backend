import { Clock } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface Props {
  open: boolean;
  secondsLeft: number;
  onExtend: () => void;
  onLogout: () => void;
}

export function SessionTimeoutDialog({ open, secondsLeft, onExtend, onLogout }: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-base">Session expiring soon</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            You've been inactive for a while. For your security, you'll be automatically
            signed out in{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {fmt(secondsLeft)}
            </span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2">
          <Button variant="outline" onClick={onLogout}>
            Sign out now
          </Button>
          <Button onClick={onExtend}>
            Stay signed in
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
