import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Share2, Copy, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const shareSchema = z.object({
  sharedByName: z.string().min(1, "Your name is required"),
  sharedByEmail: z.string().email("Valid email is required"),
  recipientName: z.string().min(1, "Recipient name is required"),
  recipientEmail: z.string().email("Valid recipient email is required").optional().or(z.literal("")),
  accessLevel: z.enum(["view", "edit"]),
  notes: z.string().optional(),
});

type ShareInfo = z.infer<typeof shareSchema>;

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

interface AccessToken {
  id: string;
  token: string;
  access_level: string;
  recipient_name: string;
  recipient_email: string;
  notes: string;
  created_at: string;
  access_count: number;
  is_active: boolean;
}

export function ShareDialog({ isOpen, onClose, sessionId }: ShareDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [existingTokens, setExistingTokens] = useState<AccessToken[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<ShareInfo>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      sharedByName: "",
      sharedByEmail: "",
      recipientName: "",
      recipientEmail: "",
      accessLevel: "view",
      notes: "",
    },
  });

  const loadExistingTokens = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_access_tokens")
        .select("*")
        .eq("session_id", sessionId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExistingTokens(data || []);
    } catch (error) {
      console.error("Error loading existing tokens:", error);
    }
  }, [sessionId]);

  React.useEffect(() => {
    if (isOpen) {
      loadExistingTokens();
    }
  }, [isOpen, loadExistingTokens]);

  const generateShareLink = async (data: ShareInfo) => {
    setIsGenerating(true);
    try {
      // Create access token
      const { data: tokenData, error: tokenError } = await supabase
        .from("inventory_access_tokens")
        .insert({
          session_id: sessionId,
          access_level: data.accessLevel,
          recipient_name: data.recipientName,
          recipient_email: data.recipientEmail || null,
          notes: data.notes || null,
          created_by_name: data.sharedByName,
          created_by_email: data.sharedByEmail,
        })
        .select("token")
        .single();

      if (tokenError) throw tokenError;

      // Update session to mark as shared
      const { error: sessionError } = await supabase
        .from("inventory_sessions")
        .update({
          access_mode: "shared",
          shared_at: new Date().toISOString(),
          shared_by_name: data.sharedByName,
          shared_by_email: data.sharedByEmail,
        })
        .eq("id", sessionId);

      if (sessionError) throw sessionError;

      toast({
        title: "Share link generated successfully!",
        description: "You can now copy and share the link with the moving representative.",
      });

      // Reload tokens to show the new one
      await loadExistingTokens();
      form.reset();
    } catch (error: any) {
      console.error("Error generating share link:", error);
      toast({
        title: "Error generating share link",
        description: error.message || "Failed to create share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (token: string) => {
    const shareUrl = `${window.location.origin}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedToken(token);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to your clipboard.",
      });
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const revokeAccess = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from("inventory_access_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);

      if (error) throw error;

      toast({
        title: "Access revoked",
        description: "The share link has been deactivated.",
      });

      await loadExistingTokens();
    } catch (error: any) {
      console.error("Error revoking access:", error);
      toast({
        title: "Error revoking access",
        description: error.message || "Failed to revoke access. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Inventory
          </DialogTitle>
          <DialogDescription>
            Generate a secure link to share this inventory with moving representatives.
          </DialogDescription>
        </DialogHeader>

        {existingTokens.length > 0 && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium text-sm">Active Share Links</h4>
            {existingTokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between p-3 border rounded bg-background">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{token.recipient_name}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      token.access_level === 'edit' 
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {token.access_level === 'edit' ? 'Can Edit' : 'View Only'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {token.recipient_email} • Created {new Date(token.created_at).toLocaleDateString()}
                    {token.access_count > 0 && ` • Accessed ${token.access_count} times`}
                  </p>
                  {token.notes && (
                    <p className="text-xs text-muted-foreground mt-1">Note: {token.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(token.token)}
                    className="text-xs"
                  >
                    {copiedToken === token.token ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revokeAccess(token.id)}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(generateShareLink)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sharedByName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sharedByEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moving Rep Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter rep name"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rep Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter rep email"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="accessLevel"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Access Level</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-3">
                        <RadioGroupItem value="view" id="view" />
                        <Label htmlFor="view" className="flex-1 cursor-pointer">
                          <div className="font-medium">View Only</div>
                          <div className="text-xs text-muted-foreground">
                            Can view and print inventory, but cannot edit
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-3">
                        <RadioGroupItem value="edit" id="edit" />
                        <Label htmlFor="edit" className="flex-1 cursor-pointer">
                          <div className="font-medium">View & Edit</div>
                          <div className="text-xs text-muted-foreground">
                            Can view, edit, add, and delete inventory items
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any special instructions or notes for the moving rep..."
                      className="min-h-[80px]"
                      {...field}
                      disabled={isGenerating}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Link...
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    Generate Share Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}