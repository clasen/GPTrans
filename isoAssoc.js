const countryName = {
    'ar': 'Argentina',
    'us': 'United States',
    'es': 'Spain',
    'pt': 'Portugal',
    'br': 'Brazil',
    'gb': 'United Kingdom',
    'au': 'Australia',
    'ca': 'Canada',
    'cn': 'China',
    'tw': 'Taiwan',
    'hk': 'Hong Kong',
    'sg': 'Singapore',
    'mx': 'Mexico',
    'in': 'India',
    'sa': 'Saudi Arabia',
    'bd': 'Bangladesh',
    'ru': 'Russia',
    'jp': 'Japan',
    'fr': 'France',
    'de': 'Germany',
    'at': 'Austria',
    'ch': 'Switzerland',
    'kr': 'South Korea',
    'it': 'Italy',
    'tr': 'Turkey',
    'vn': 'Vietnam',
    'pl': 'Poland',
    'nl': 'Netherlands',
    'be': 'Belgium',
    'id': 'Indonesia',
    'th': 'Thailand',
    'ph': 'Philippines',
    'ir': 'Iran',
    'ua': 'Ukraine',
    'il': 'Israel',
    'se': 'Sweden',
    'no': 'Norway',
    'fi': 'Finland',
    'cz': 'Czech Republic',
    'hu': 'Hungary',
    'ro': 'Romania',
    'bg': 'Bulgaria',
    'co': 'Colombia',
    'cl': 'Chile',
    'pe': 'Peru',
    've': 'Venezuela',
    'ec': 'Ecuador',
    'uy': 'Uruguay',
    'py': 'Paraguay',
    'bo': 'Bolivia',
    'cr': 'Costa Rica',
    'nz': 'New Zealand',
    'gr': 'Greece',
    'dk': 'Denmark'
};

const countryDenonym = {
    'ar': 'Argentinian',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'br': 'Brazilian',
    'us': 'American',
    'gb': 'British',
    'au': 'Australian',
    'ca': 'Canadian',
    'cn': 'Chinese',
    'tw': 'Taiwanese',
    'hk': 'Hong Kongese',
    'sg': 'Singaporean',
    'mx': 'Mexican',
    'in': 'Indian',
    'sa': 'Saudi Arabian',
    'bd': 'Bangladeshi',
    'ru': 'Russian',
    'jp': 'Japanese',
    'fr': 'French',
    'de': 'German',
    'at': 'Austrian',
    'ch': 'Swiss',
    'kr': 'Korean',
    'it': 'Italian',
    'tr': 'Turkish',
    'vn': 'Vietnamese',
    'pl': 'Polish',
    'nl': 'Dutch',
    'be': 'Belgian',
    'id': 'Indonesian',
    'th': 'Thai',
    'ph': 'Filipino',
    'ir': 'Iranian',
    'ua': 'Ukrainian',
    'il': 'Israeli',
    'se': 'Swedish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'cz': 'Czech',
    'hu': 'Hungarian',
    'ro': 'Romanian',
    'bg': 'Bulgarian',
    'co': 'Colombian',
    'cl': 'Chilean',
    'pe': 'Peruvian',
    've': 'Venezuelan',
    'ec': 'Ecuadorian',
    'uy': 'Uruguayan',
    'py': 'Paraguayan',
    'bo': 'Bolivian',
    'cr': 'Costa Rican',
    'nz': 'New Zealander',
    'gr': 'Greek',
    'dk': 'Danish'
};

const langName = {
    'es': 'Spanish',
    'pt': 'Portuguese',
    'en': 'English',
    'zh': 'Chinese',
    'hi': 'Hindi',
    'ar': 'Arabic',
    'bn': 'Bengali',
    'ru': 'Russian',
    'ja': 'Japanese',
    'fr': 'French',
    'de': 'German',
    'ko': 'Korean',
    'it': 'Italian',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'pl': 'Polish',
    'nl': 'Dutch',
    'id': 'Indonesian',
    'th': 'Thai',
    'tl': 'Tagalog',
    'fa': 'Persian',
    'uk': 'Ukrainian',
    'he': 'Hebrew',
    'sv': 'Swedish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'cs': 'Czech',
    'hu': 'Hungarian',
    'ro': 'Romanian',
    'bg': 'Bulgarian',
    'ca': 'Catalan',
    'gl': 'Galician',
    'eu': 'Basque',
    'el': 'Greek',
    'da': 'Danish',
    'ur': 'Urdu',
    'ms': 'Malay'
};

export function isLanguageAvailable(isoCode) {
    if (!isoCode) return false;
    
    const parts = isoCode.toLowerCase().split('-');
    const lang = parts[0];
    const country = parts.length > 1 ? parts[1] : null;
    
    // Verificar si el idioma existe
    if (!langName[lang]) return false;
    
    // Si hay código de país, verificar si existe
    if (country && !countryName[country]) return false;
    
    return true;
}

export function isoAssoc(iso, prefix = '') {
    if (!iso) {
        throw new Error('ISO code is required');
    }
    
    // Usar la nueva función para validar el ISO
    if (!isLanguageAvailable(iso)) {
        throw new Error(`Invalid ISO code: ${iso}`);
    }

    const parts = iso.toLowerCase().split('-');
    const lang = parts[0];
    const country = parts.length > 1 ? parts[1] : null;

    let denonym = country ? countryDenonym[country] : 'Neutral';

    if (lang === 'zh' && !country) {
        denonym = 'Simplified';
    }
    else if (lang === 'ar' && !country) {
        denonym = 'Standard';
    }

    return {
        [prefix + 'ISO']: iso,
        [prefix + 'LANG']: langName[lang],
        [prefix + 'COUNTRY']: country ? countryName[country] : langName[lang],
        [prefix + 'DENONYM']: denonym,
    };
} 