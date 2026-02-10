import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

interface HealAndRestoreModalProps {
  isOpen: boolean;
  onAuthorize: (autoApprove: boolean) => void;
  onCancel: () => void;
  sessionId: string;
}

export const HealAndRestoreModal: React.FC<HealAndRestoreModalProps> = ({
  isOpen,
  onAuthorize,
  onCancel,
}) => {
  const [autoApprove, setAutoApprove] = useState(false);

  const handleAuthorize = () => {
    // Save auto-approve preference to session storage
    if (autoApprove) {
      sessionStorage.setItem('autoApproveHealRestore', 'true');
    }
    onAuthorize(autoApprove);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Heal & Restore Authorization Required</DialogTitle>
          <DialogDescription>
            The system has reached a heal and restore checkpoint and requires your authorization to
            continue. This process will attempt to recover and restore any corrupted or missing
            data.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-approve"
              checked={autoApprove}
              onCheckedChange={(checked) => setAutoApprove(checked as boolean)}
            />
            <label
              htmlFor="auto-approve"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Auto-approve future heal & restore sessions for this browser session
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleAuthorize}>Authorize Heal & Restore</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
