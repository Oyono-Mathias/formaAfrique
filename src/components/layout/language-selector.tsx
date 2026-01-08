
"use client";

import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import Image from 'next/image';

interface LanguageOption {
    code: string;
    name: string;
    flag: string;
}

const languages: LanguageOption[] = [
    { code: 'fr', name: 'Français', flag: '/flags/fr.svg' },
    { code: 'en', name: 'English', flag: '/flags/gb.svg' },
    { code: 'sg', name: 'Sango', flag: '/flags/cf.svg' },
];

export function LanguageSelector() {
    const { i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const selectedLanguage = languages.find(l => l.code === i18n.language) || languages[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                    <Image src={selectedLanguage.flag} alt={selectedLanguage.name} width={20} height={15} />
                    <span className="hidden md:inline text-sm">{selectedLanguage.name}</span>
                    <Globe className="h-4 w-4 md:hidden" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:bg-slate-800 dark:border-slate-700">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className="flex items-center gap-2 cursor-pointer dark:hover:bg-slate-700"
                    >
                        <Image src={lang.flag} alt={lang.name} width={20} height={15} />
                        <span className="dark:text-white">{lang.name}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
