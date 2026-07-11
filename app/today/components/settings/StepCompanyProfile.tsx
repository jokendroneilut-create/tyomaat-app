"use client"

import { companyProfiles } from "./todaySettingsConfig"

type StepCompanyProfileProps = {
  selectedProfile: string | null
  onChange: (profile: string) => void
}

export default function StepCompanyProfile({
  selectedProfile,
  onChange,
}: StepCompanyProfileProps) {
  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">
        Mikä kuvaa yritystäsi parhaiten?
      </h3>

      <p className="mt-2 text-gray-600">
        Valintaa voidaan myöhemmin käyttää suositeltujen asetusten pohjana.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {companyProfiles.map((profile) => (
          <button
            key={profile}
            type="button"
            onClick={() => onChange(profile)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${
              selectedProfile === profile
                ? "border-gray-900 bg-gray-900 text-white"
                : "hover:bg-gray-50"
            }`}
          >
            {profile}
          </button>
        ))}
      </div>
    </div>
  )
}