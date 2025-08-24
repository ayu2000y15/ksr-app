import { Check, X, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type OptionType = {
    label: string;
    value: number; // IDが数値なのでnumberに合わせます
};

interface MultiSelectComboboxProps {
    options: OptionType[];
    selected: number[];
    onChange: React.Dispatch<React.SetStateAction<number[]>>;
    className?: string;
    placeholder?: string;
}

function MultiSelectCombobox({ options, selected, onChange, className, placeholder = '選択してください...' }: MultiSelectComboboxProps) {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (value: number) => {
        onChange((prevSelected) => {
            if (prevSelected.includes(value)) {
                return prevSelected.filter((item) => item !== value);
            } else {
                return [...prevSelected, value];
            }
        });
    };

    const selectedOptions = selected.map((value) => options.find((option) => option.value === value)).filter(Boolean) as OptionType[];

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
                    <div className="flex flex-wrap items-center gap-1">
                        {selectedOptions.length > 0 ? (
                            selectedOptions.map((option) => (
                                <Badge variant="secondary" key={option.value} className="mr-1">
                                    {option.label}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
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
                                const isSelected = selected.includes(option.value);
                                return (
                                    <CommandItem key={option.value} onSelect={() => handleSelect(option.value)}>
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

export { MultiSelectCombobox };
