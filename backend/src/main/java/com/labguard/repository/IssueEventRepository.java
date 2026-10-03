package com.labguard.repository;

import com.labguard.entity.IssueEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IssueEventRepository extends JpaRepository<IssueEvent, UUID> {
    List<IssueEvent> findByIssueIdOrderByCreatedAtAsc(UUID issueId);
}
