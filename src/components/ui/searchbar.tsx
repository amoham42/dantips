import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { ThreadListItemPrimitive, ThreadListPrimitive } from "@assistant-ui/react"
import { type FC } from "react"

interface SearchbarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function Searchbar({ open, onOpenChange }: SearchbarProps) {
    return (
        <CommandDialog 
            open={open} 
            onOpenChange={onOpenChange}
            title="Search"
            description="Search for recent chats..."
        >
            <CommandInput placeholder="Search for recent chats..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Recent Chats">
                    <ThreadListPrimitive.Root>
                        <ThreadListPrimitive.Items components={{ ThreadListItem: SearchThreadListItem(onOpenChange) }} />
                    </ThreadListPrimitive.Root>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}

const SearchThreadListItem = (onOpenChange: (open: boolean) => void): FC => {
  const Component: FC = () => {
    const handleThreadSelect = () => {
        // Close the search dialog after thread selection
        // ThreadListItemPrimitive.Trigger handles the thread navigation automatically
        onOpenChange(false);
    };

    return (
        <ThreadListItemPrimitive.Root>
            <CommandItem asChild onSelect={handleThreadSelect}>
                <ThreadListItemPrimitive.Trigger className="w-full">
                    <ThreadListItemPrimitive.Title fallback="New Chat" />
                </ThreadListItemPrimitive.Trigger>
            </CommandItem>
        </ThreadListItemPrimitive.Root>
    );
  };
  
  Component.displayName = 'SearchThreadListItem';
  return Component;
};