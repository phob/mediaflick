import { FlatCompat } from "@eslint/eslintrc"
import { dirname } from "path"
import { fileURLToPath } from "url"
import checkFile from "eslint-plugin-check-file"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
    baseDirectory: __dirname,
})

const eslintConfig = [{
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}, ...compat.extends("next/core-web-vitals", "next/typescript"), {
    files: ["**/*.{ts,tsx}"],
    plugins: {
        "check-file": checkFile
    },
    rules: {
        "check-file/folder-naming-convention": [
            "error",
            {
                "src/!(*)/**": "KEBAB_CASE"
            }
        ]
    }
}]

export default eslintConfig
