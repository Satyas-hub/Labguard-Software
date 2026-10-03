package com.labguard.repository;

import com.labguard.entity.Issue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IssueRepository extends JpaRepository<Issue, UUID> {
    Optional<Issue> findByIssueCode(String issueCode);
    List<Issue> findByLabIdOrderByCreatedAtDesc(UUID labId);
    List<Issue> findByReportedByUserIdOrderByCreatedAtDesc(UUID userId);
    List<Issue> findByStatusOrderByCreatedAtDesc(String status);

    @Query("SELECT COUNT(i) FROM Issue i WHERE i.status NOT IN ('RESOLVED', 'REJECTED')")
    long countOpenIssues();

    @Query("SELECT COUNT(i) FROM Issue i WHERE i.lab.id = :labId AND i.status NOT IN ('RESOLVED', 'REJECTED')")
    long countOpenIssuesInLab(@Param("labId") UUID labId);
}
