#!/usr/bin/env ruby

require "json"
require "yaml"

ROOT = File.expand_path("..", __dir__)
UPSTREAM_GUARD = "github.repository == 'block/buzz'"
PUBLISH_PATTERN = /"permission-[a-z-]+":"write"|docker\/build-push-action|\bhelm push\b|\bgh release (?:create|edit|upload)\b|\bgit push\b/

def write_permissions?(permissions)
  return permissions == "write-all" if permissions.is_a?(String)
  return false unless permissions.is_a?(Hash)

  permissions.any? { |_scope, access| access == "write" }
end

def wrapped?(expression)
  return false unless expression.start_with?("(") && expression.end_with?(")")

  depth = 0
  expression.each_char.with_index do |character, index|
    depth += 1 if character == "("
    depth -= 1 if character == ")"
    return false if depth.zero? && index < expression.length - 1
  end
  depth.zero?
end

def exclusive_upstream_guard?(condition)
  normalized = condition&.split&.join(" ")
  return true if normalized == UPSTREAM_GUARD
  return false unless normalized&.start_with?("#{UPSTREAM_GUARD} && ")

  remainder = normalized.delete_prefix("#{UPSTREAM_GUARD} && ").strip
  !remainder.include?("||") || wrapped?(remainder)
end

quoted_fixture = YAML.safe_load(<<~YAML)
  'permissions':
    'contents': 'write'
YAML
raise "quoted permission fixture was not recognized" unless write_permissions?(quoted_fixture.fetch("permissions"))
raise "quoted write-all fixture was not recognized" unless write_permissions?(YAML.safe_load('permissions: "write-all"').fetch("permissions"))

guarded_count = 0
Dir.glob(File.join(ROOT, ".github/workflows/*.{yml,yaml}")).sort.each do |path|
  workflow = YAML.safe_load(File.read(path), aliases: true)
  jobs = workflow.fetch("jobs", {})
  workflow_permissions = workflow["permissions"]

  jobs.each do |job_id, job|
    raise "#{path}: job #{job_id} must be an object" unless job.is_a?(Hash)

    effective_permissions = job.key?("permissions") ? job["permissions"] : workflow_permissions
    serialized = JSON.generate(job)
    dangerous = write_permissions?(effective_permissions) || serialized.match?(PUBLISH_PATTERN)
    next unless dangerous

    unless exclusive_upstream_guard?(job["if"])
      relative = path.delete_prefix("#{ROOT}/")
      raise "#{relative}: write-capable job #{job_id} is not exclusively fork-gated to block/buzz"
    end
    guarded_count += 1
  end
end

raise "no write-capable publication jobs were discovered" if guarded_count.zero?
puts "All #{guarded_count} inherited write-capable jobs are fork-gated."
