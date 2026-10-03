package com.labguard.repository;

import com.labguard.entity.ClassStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClassStudentRepository extends JpaRepository<ClassStudent, UUID> {
    List<ClassStudent> findByClassSessionId(UUID classSessionId);
    List<ClassStudent> findByStudentId(UUID studentId);
}
