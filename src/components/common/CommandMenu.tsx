import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, CirclePlus, MessagesSquare, Search, Settings, Upload } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface CommandMenuProps {
  isAdmin: boolean;
}

export function CommandMenu({ isAdmin }: CommandMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem
            value="search characters"
            onSelect={() => {
              setOpen(false);
              void navigate({ to: "/characters" });
            }}
          >
            <Search />
            Search characters
          </CommandItem>
          <CommandItem
            value="chats"
            onSelect={() => {
              setOpen(false);
              void navigate({ to: "/chat" });
            }}
          >
            <MessagesSquare />
            Chats
          </CommandItem>
          <CommandItem
            value="lorebooks"
            onSelect={() => {
              setOpen(false);
              void navigate({ to: "/lorebooks" });
            }}
          >
            <BookOpen />
            Lorebooks
          </CommandItem>
          <CommandItem
            value="settings"
            onSelect={() => {
              setOpen(false);
              void navigate({ to: "/settings" });
            }}
          >
            <Settings />
            Settings
          </CommandItem>
        </CommandGroup>
        {isAdmin ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              <CommandItem
                value="import character"
                onSelect={() => {
                  setOpen(false);
                  void navigate({ to: "/characters/new" });
                }}
              >
                <Upload />
                Import character
              </CommandItem>
              <CommandItem
                value="new lorebook"
                onSelect={() => {
                  setOpen(false);
                  void navigate({ to: "/lorebooks/new" });
                }}
              >
                <CirclePlus />
                New lorebook
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
