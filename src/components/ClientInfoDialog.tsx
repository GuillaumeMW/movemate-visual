import React from "react";
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
import { Loader2, FileText } from "lucide-react";

const clientInfoSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  city: z.string().min(1, "City is required"),
  quoteId: z.string().optional(),
});

type ClientInfo = z.infer<typeof clientInfoSchema>;

interface ClientInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientInfo: ClientInfo) => void;
  isGenerating: boolean;
}

export function ClientInfoDialog({
  isOpen,
  onClose,
  onSubmit,
  isGenerating,
}: ClientInfoDialogProps) {
  const form = useForm<ClientInfo>({
    resolver: zodResolver(clientInfoSchema),
    defaultValues: {
      clientName: "",
      city: "",
      quoteId: "",
    },
  });

  const handleSubmit = (data: ClientInfo) => {
    onSubmit(data);
  };

  const handleClose = () => {
    if (!isGenerating) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate PDF Report
          </DialogTitle>
          <DialogDescription>
            Enter client information to generate a professional inventory report.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter client name"
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
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter city"
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
              name="quoteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quote ID (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter quote ID if applicable"
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
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate PDF
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