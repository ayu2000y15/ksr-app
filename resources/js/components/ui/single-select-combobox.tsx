import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type OptionType = { label: string; value: number | string; disabled?: boolean };

interface SingleSelectComboboxProps {
    options: OptionType[];
    selected?: number | string | null;
    onChange: (value: number | string | null) => void;
    className?: string;
    placeholder?: string;
}

function SingleSelectCombobox({ options, selected = null, onChange, className, placeholder = '選択してください...' }: SingleSelectComboboxProps) {
    const [open, setOpen] = React.useState(false);

    const selectedOption = options.find((o) => o.value === selected);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between font-normal', className)}
                    onClick={() => setOpen(!open)}
                >
                    <div className="truncate text-left">
                        {selectedOption ? selectedOption.label : <span className="text-muted-foreground">{placeholder}</span>}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="検索..." />
                    <CommandList>
                        <CommandEmpty>見つかりません</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = option.value === selected;
                                const isDisabled = !!option.disabled;
                                return (
                                    <CommandItem
                                        key={String(option.value)}
                                        onSelect={() => {
                                            if (isDisabled) return; // ignore selection for disabled options
                                            onChange(option.value);
                                            setOpen(false);
                                        }}
                                        aria-disabled={isDisabled}
                                        className={cn(isDisabled ? 'opacity-50 pointer-events-none' : '')}
                                    >
                                        <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                        {option.label}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export { SingleSelectCombobox };
