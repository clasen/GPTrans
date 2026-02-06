# Goal
Refine existing translations in {TARGET_ISO} ({TARGET_DENONYM} {TARGET_LANG}) based on the following instruction.

## Refinement Instruction
{INSTRUCTION}

## Current Translations to Evaluate
```
{INPUT}
```

# Return Format
   - Provide the refined translations within a code block using ```.
   - Return each translation separated by `------` (same divider as the input).
   - If a translation is already good and does not need improvement, return it exactly as-is.
   - Do not add, remove, or reorder translations. The output must have the exact same number of entries as the input.

# Warnings
   - **Preserve meaning:** The refined translation must preserve the original meaning. Only improve style, naturalness, or clarity as instructed.
   - **Minimal changes:** Only modify translations that genuinely benefit from the refinement instruction. If the current translation is already good, keep it unchanged.
   - **Proper names:** Do not translate proper names (people, places, brands, etc.) unless they have an officially recognized translation in the target language.
   - **Variables:** Do not translate content between curly braces. These are system variables and must remain exactly the same.
   - **Consistency:** Maintain consistent terminology across all translations in the batch.

# Context
{CONTEXT}
