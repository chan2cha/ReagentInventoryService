import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: ["public/**"]
  },
  ...nextVitals
];

export default eslintConfig;
